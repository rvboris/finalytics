import agent from '../agent';
import test from 'ava';

let request;

test.before(async () => {
  request = await agent();

  await request.post('/api/auth/register').send({
    email: 'test@test.ru',
    password: '12345678',
    repeatPassword: '12345678',
  });
});

test('user get profile', async t => {
  const res = await request.get('/api/user/profile');

  t.is(res.status, 200);
  t.is(res.body.email, 'test@test.ru');
  t.is(res.body.status, 'init');
  t.true(typeof res.body.settings === 'object');
});

test('user set settings', async t => {
  let res = await request.post('/api/user/settings').send({ test: 1 });

  t.true(typeof res.body.locale === 'string');
  t.true(typeof res.body.baseCurrency === 'string');
  t.true(!res.body.test);
  t.is(res.status, 200);

  res = await request.post('/api/user/settings').send({
    timezone: 'Europe/Moscow',
    locale: 'en',
  });

  t.is(res.body.timezone, 'Europe/Moscow');
  t.is(res.body.locale, 'en');
  t.is(res.status, 200);

  res = await request.post('/api/user/settings')
    .set('Accept-Language', 'ru-RU,ru;q=0.8,en-US;q=0.6,en;q=0.4')
    .send({ locale: 'auto' });

  t.is(res.body.locale, 'ru');
  t.is(res.status, 200);
});

test('user set status', async t => {
  let res = await request.post('/api/user/status').send({ status: 'wrong' });

  t.is(res.status, 500);

  res = await request.post('/api/user/status').send({});

  t.is(res.status, 200);
  t.is(res.body.status, 'init');

  res = await request.post('/api/user/status').send({ status: 'init' });

  t.is(res.status, 200);
  t.is(res.body.status, 'init');

  res = await request.post('/api/user/status').send({ status: 'ready' });

  t.is(res.status, 200);
  t.is(res.body.status, 'ready');
});
