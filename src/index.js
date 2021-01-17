const {router, setQueues, BullMQAdapter, BullAdapter} = require('bull-board');
const Queue = require('bull');
const bullmq = require('bullmq');
const express = require('express');
const redis = require('redis');
const session = require('express-session');
const passport = require('passport');
const {ensureLoggedIn} = require('connect-ensure-login');
const bodyParser = require('body-parser');

const {authRouter} = require('./login');
const config = require('./config');

const redisConfig = {
	redis: {
		port: config.REDIS_PORT,
		host: config.REDIS_HOST,
		...(config.REDIS_PASSWORD && {password: config.REDIS_PASSWORD}),
		tls: config.REDIS_USE_TLS === 'true',
	},
};

const client = redis.createClient(redisConfig.redis);

client.KEYS(`${config.BULL_PREFIX}:*`, (err, keys) => {
	const uniqKeys = new Set(keys.map(key => key.replace(/^.+?:(.+?):.+?$/, '$1')));
	const queueList = Array.from(uniqKeys).sort().map(
		(item) => {
			if (config.BULL_VERSION === 'BULLMQ') {
				return new BullMQAdapter(new bullmq.Queue(item, {connection: redisConfig.redis}));
			}

			return new BullAdapter(new Queue(item, redisConfig));
		}
	);

	setQueues(queueList);
});

const app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

app.use(session({secret: Math.random().toString(), resave: false, saveUninitialized: false}));
app.use(passport.initialize({}));
app.use(passport.session({}));

app.use(bodyParser.urlencoded({extended: false}));

if (config.AUTH_ENABLED) {
	app.use(config.LOGIN_PAGE, authRouter);
	app.use(config.HOME_PAGE, ensureLoggedIn(config.LOGIN_PAGE), router);
}
else {
	app.use(config.HOME_PAGE, router);
}

app.listen(config.PORT, () => {
	console.log(`bull-board is started http://localhost:${config.PORT}${config.HOME_PAGE}`);
});