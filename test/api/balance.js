import test from 'ava';
import moment from 'moment';
import TreeModel from 'tree-model';
import { sample, filter } from 'lodash';
import money from 'money';
import big from 'big.js';

import agent from '../agent';
import rates from '../../src/server/fixtures/rates';

let request;

let accounts;
let categoryList;
let incomeCategoryList;
let expenseCategoryList;
let currencyList;

test.before(async () => {
  money.base = rates.base;
  money.rates = rates.rates;

  request = await agent();

  await request.post('/api/auth/register').send({
    email: 'test@balance.ru',
    password: '12345678',
    repeatPassword: '12345678',
  });

  let res = await request.get('/api/account/load');

  accounts = res.body.accounts;

  res = await request.get('/api/category/load');

  const tree = new TreeModel();
  const categoryRoot = tree.parse(res.body.data);

  categoryList = categoryRoot.all();
  incomeCategoryList = filter(categoryList, category => category.model.type === 'income');
  expenseCategoryList = filter(categoryList, category => category.model.type === 'expense');

  res = await request.get('/api/currency/load');
  currencyList = res.body.currencyList;
});

test.serial('add income operation', async (t) => {
  const accountToCheck = accounts[0];
  const amount = 100;

  let res = await request.post('/api/operation/add').send({
    created: moment.utc('2016-01-10'),
    account: accountToCheck._id,
    category: sample(incomeCategoryList).model._id,
    amount,
  });

  t.is(res.status, 200);
  t.is(res.body.balance, 100);

  res = await request.get('/api/account/load');

  t.is(res.status, 200);
  t.is(res.body.accounts[0].currentBalance, 100);
  t.is(res.body.accounts[0].startBalance, 0);
});

test.serial('add expense operation', async (t) => {
  const accountToCheck = accounts[0];
  const amount = -200;

  let res = await request.post('/api/operation/add').send({
    created: moment.utc('2016-01-20'),
    account: accountToCheck._id,
    category: sample(expenseCategoryList).model._id,
    amount,
  });

  t.is(res.status, 200);
  t.is(res.body.balance, -100);

  res = await request.get('/api/account/load');

  t.is(res.status, 200);
  t.is(res.body.accounts[0].currentBalance, -100);
  t.is(res.body.accounts[0].startBalance, 0);
});

test.serial('insert income operation at start', async (t) => {
  const accountToCheck = accounts[0];
  const amount = 500;

  let res = await request.post('/api/operation/add').send({
    created: moment.utc('2016-01-09'),
    account: accountToCheck._id,
    category: sample(incomeCategoryList).model._id,
    amount,
  });

  t.is(res.status, 200);
  t.is(res.body.balance, 400);

  res = await request.get('/api/account/load');

  t.is(res.status, 200);
  t.is(res.body.accounts[0].currentBalance, 400);
  t.is(res.body.accounts[0].startBalance, 0);

  res = await request.get('/api/operation/list');

  t.is(res.status, 200);
  t.is(res.body.total, 3);
  t.is(res.body.operations[0].balance, 400);
  t.is(res.body.operations[1].balance, 600);
  t.is(res.body.operations[2].balance, 500);
});

test.serial('update operation date', async (t) => {
  let res = await request.get('/api/operation/list');
  t.is(res.status, 200);

  const operationToUpdate = res.body.operations[2];

  res = await request.post('/api/operation/update').send({
    _id: operationToUpdate._id,
    created: moment.utc('2016-01-15'),
  });

  t.is(res.status, 200);
  t.is(res.body.balance, 600);

  res = await request.get('/api/operation/list');

  t.is(res.status, 200);
  t.is(res.body.operations[0].balance, 400);
  t.is(res.body.operations[1].balance, 600);
  t.is(res.body.operations[2].balance, 100);
});

test.serial('update operation amount', async (t) => {
  let res = await request.get('/api/operation/list');
  t.is(res.status, 200);

  const operationToUpdate = res.body.operations[1];
  const newAmount = 300;

  res = await request.post('/api/operation/update').send({
    _id: operationToUpdate._id,
    amount: newAmount,
  });

  t.is(res.status, 200);

  res = await request.get('/api/operation/list');

  t.is(res.status, 200);
  t.is(res.body.operations[0].balance, 200);
  t.is(res.body.operations[1].balance, 400);
  t.is(res.body.operations[2].balance, 100);
});

test.serial('update operation account', async (t) => {
  let res = await request.get('/api/operation/list');
  t.is(res.status, 200);

  const operationToUpdate = res.body.operations[1];
  const newAccountId = accounts[1]._id;

  res = await request.post('/api/operation/update').send({
    _id: operationToUpdate._id,
    account: newAccountId,
  });

  t.is(res.status, 200);

  res = await request.get('/api/operation/list');

  t.is(res.status, 200);
  t.is(res.body.operations[0].balance, -100);
  t.is(res.body.operations[1].balance, 300);
  t.is(res.body.operations[2].balance, 100);

  res = await request.get('/api/account/load');

  t.is(res.status, 200);
  t.is(res.body.accounts[0].currentBalance, -100);
  t.is(res.body.accounts[1].currentBalance, 300);
});

test.serial('remove operation at start', async (t) => {
  let res = await request.get('/api/operation/list');
  t.is(res.status, 200);

  const operationToDelete = res.body.operations[2];

  res = await request.post('/api/operation/delete').send({
    _id: operationToDelete._id,
  });

  t.is(res.status, 200);

  res = await request.get('/api/operation/list');

  t.is(res.status, 200);
  t.is(res.body.total, 2);
  t.is(res.body.operations[0].balance, -200);
  t.is(res.body.operations[1].balance, 300);

  res = await request.get('/api/account/load');

  t.is(res.status, 200);
  t.is(res.body.accounts[0].currentBalance, -200);
  t.is(res.body.accounts[1].currentBalance, 300);
});

test.serial('remove operation at end', async (t) => {
  let res = await request.get('/api/operation/list');
  t.is(res.status, 200);

  const operationToDelete = res.body.operations[1];

  res = await request.post('/api/operation/delete').send({
    _id: operationToDelete._id,
  });

  t.is(res.status, 200);

  res = await request.get('/api/operation/list');

  t.is(res.status, 200);
  t.is(res.body.total, 1);
  t.is(res.body.operations[0].balance, -200);

  res = await request.get('/api/account/load');

  t.is(res.status, 200);
  t.is(res.body.accounts[0].currentBalance, -200);
  t.is(res.body.accounts[1].currentBalance, 0);
});

test.serial('remove operation last operation', async (t) => {
  let res = await request.get('/api/operation/list');
  t.is(res.status, 200);

  const operationToDelete = res.body.operations[0];

  res = await request.post('/api/operation/delete').send({
    _id: operationToDelete._id,
  });

  t.is(res.status, 200);

  res = await request.get('/api/operation/list');

  t.is(res.status, 200);
  t.is(res.body.total, 0);

  res = await request.get('/api/account/load');

  t.is(res.status, 200);
  t.is(res.body.accounts[0].currentBalance, 0);
  t.is(res.body.accounts[1].currentBalance, 0);
});

test.serial('account with start balance', async (t) => {
  let res = await request.post('/api/account/add').send({
    name: 'start balance test',
    startBalance: 1000,
    type: 'standart',
    currency: sample(currencyList)._id,
  });

  t.is(res.status, 200);
  t.is(res.body.accounts.length, 3);
  t.is(res.body.accounts[2].startBalance, 1000);
  t.is(res.body.accounts[2].currentBalance, 1000);

  const accountToCheck = res.body.accounts[2];
  const amount = 100;

  res = await request.post('/api/operation/add').send({
    created: moment.utc('2016-02-01'),
    account: accountToCheck._id,
    category: sample(incomeCategoryList).model._id,
    amount,
  });

  t.is(res.status, 200);
  t.is(res.body.balance, 1100);

  res = await request.get('/api/account/load');

  t.is(res.status, 200);
  t.is(res.body.accounts[0].currentBalance, 0);
  t.is(res.body.accounts[1].currentBalance, 0);
  t.is(res.body.accounts[2].currentBalance, 1100);
});

test.serial('update account start balance', async (t) => {
  let res = await request.get('/api/account/load');

  t.is(res.status, 200);

  const accountToUpdate = res.body.accounts[2];
  const newStartBalance = 500;

  res = await request.post('/api/account/update').send({
    _id: accountToUpdate._id,
    startBalance: newStartBalance,
  });

  t.is(res.status, 200);
  t.is(res.body.accounts[2].startBalance, 500);
  t.is(res.body.accounts[2].currentBalance, 600);

  res = await request.get('/api/operation/list').query({ account: accountToUpdate._id });

  t.is(res.status, 200);
  t.is(res.body.operations[0].balance, 600);
});

test.serial('remove account', async (t) => {
  let res = await request.get('/api/account/load');

  t.is(res.status, 200);

  const accountToDelete = res.body.accounts[2];

  res = await request.get('/api/operation/list');

  t.is(res.status, 200);
  t.is(res.body.total, 1);

  res = await request.post('/api/account/delete').send({ _id: accountToDelete._id });

  t.is(res.status, 200);

  res = await request.get('/api/operation/list');

  t.is(res.status, 200);
  t.is(res.body.total, 0);
});

test.serial('add transfer operation', async (t) => {
  let res = await request.get('/api/account/load');

  t.is(res.status, 200);

  const accountFrom = res.body.accounts[0];
  const accountTo = res.body.accounts[1];

  res = await request.post('/api/operation/addTransfer').send({
    created: moment.utc('2016-03-10'),
    accountFrom: accountFrom._id,
    accountTo: accountTo._id,
    amountFrom: 100,
    amountTo: 200,
  });

  t.is(res.status, 200);
  t.is(res.body.balance, -100);
  t.is(res.body.amount, -100);
  t.is(res.body.transfer.balance, 200);
  t.is(res.body.transfer.amount, 200);

  res = await request.get('/api/account/load');

  t.is(res.status, 200);
  t.is(res.body.accounts[0].currentBalance, -100);
  t.is(res.body.accounts[1].currentBalance, 200);
});

test.serial('insert transfer operation', async (t) => {
  let res = await request.get('/api/account/load');

  t.is(res.status, 200);

  const accountFrom = res.body.accounts[0];
  const accountTo = res.body.accounts[1];

  res = await request.post('/api/operation/addTransfer').send({
    created: moment.utc('2016-03-05'),
    accountFrom: accountFrom._id,
    accountTo: accountTo._id,
    amountFrom: 500,
    amountTo: 300,
  });

  t.is(res.status, 200);
  t.is(res.body.balance, -600);
  t.is(res.body.amount, -500);
  t.is(res.body.transfer.balance, 500);
  t.is(res.body.transfer.amount, 300);

  res = await request.get('/api/account/load');

  t.is(res.status, 200);
  t.is(res.body.accounts[0].currentBalance, -600);
  t.is(res.body.accounts[1].currentBalance, 500);
});

test.serial('update transfer operation date', async (t) => {
  let res = await request.get('/api/operation/list');

  t.is(res.status, 200);
  t.is(res.body.total, 2);

  const operationToUpdate = res.body.operations[1];

  res = await request.post('/api/operation/updateTransfer').send({
    _id: operationToUpdate._id,
    created: moment.utc('2016-03-15'),
  });

  t.is(res.status, 200);
  t.is(res.body.amount, -500);
  t.is(res.body.balance, -600);
  t.is(res.body.transfer.amount, 300);
  t.is(res.body.transfer.balance, 500);

  res = await request.get('/api/account/load');

  t.is(res.status, 200);
  t.is(res.body.accounts[0].currentBalance, -600);
  t.is(res.body.accounts[1].currentBalance, 500);
});

test.serial('update transfer operation amount', async (t) => {
  let res = await request.get('/api/operation/list');

  t.is(res.status, 200);
  t.is(res.body.total, 2);

  const operationToUpdate = res.body.operations[1];

  res = await request.post('/api/operation/updateTransfer').send({
    _id: operationToUpdate._id,
    amountFrom: 200,
    amountTo: 300,
  });

  t.is(res.status, 200);
  t.is(res.body.amount, -200);
  t.is(res.body.balance, -200);
  t.is(res.body.transfer.amount, 300);
  t.is(res.body.transfer.balance, 300);

  res = await request.get('/api/account/load');

  t.is(res.status, 200);
  t.is(res.body.accounts[0].currentBalance, -700);
  t.is(res.body.accounts[1].currentBalance, 600);
});

test.serial('update transfer operation account', async (t) => {
  let res = await request.get('/api/operation/list');

  t.is(res.status, 200);
  t.is(res.body.total, 2);

  const operationToUpdate = res.body.operations[1];

  res = await request.post('/api/operation/updateTransfer').send({
    _id: operationToUpdate._id,
    accountFrom: operationToUpdate.transfer.account,
    accountTo: operationToUpdate.account,
  });

  t.is(res.status, 200);
  t.is(res.body.amount, -200);
  t.is(res.body.balance, -200);
  t.is(res.body.transfer.amount, 300);
  t.is(res.body.transfer.balance, 300);

  res = await request.get('/api/account/load');

  t.is(res.status, 200);
  t.is(res.body.accounts[0].currentBalance, -200);
  t.is(res.body.accounts[1].currentBalance, 100);
});

test.serial('add transfer operation in different currency', async (t) => {
  let res = await request.get('/api/currency/load');

  t.is(res.status, 200);

  const currencyList = res.body.currencyList;
  const usdCurrency = currencyList[0];

  res = await request.post('/api/account/add').send({
    name: 'test account',
    startBalance: 1000,
    type: 'standart',
    currency: usdCurrency._id,
  });

  t.is(res.status, 200);

  const accountFromTransfer = res.body.accounts[0];
  const accountToTransfer = res.body.accounts[res.body.accounts.length - 1];

  t.is(accountToTransfer.startBalance, 1000);
  t.is(accountToTransfer.currentBalance, 1000);

  res = await request.post('/api/operation/addTransfer').send({
    created: moment.utc('2016-05-05'),
    accountFrom: accountFromTransfer._id,
    accountTo: accountToTransfer._id,
    amountFrom: 100,
    amountTo: 200,
  });

  t.is(res.status, 200);
  t.is(res.body.amount, -100);
  t.is(res.body.balance, -300);
  t.is(res.body.transfer.amount, 200);
  t.is(res.body.transfer.balance, 1200);
});

test.serial('balance calculation accuracy', async (t) => {
  let res = await request.get('/api/account/load');

  t.is(res.status, 200);

  const accountToCheck = res.body.accounts[0];

  t.is(accountToCheck.startBalance, 0);
  t.is(accountToCheck.currentBalance, -300);

  const amount = 10.023456;

  res = await request.post('/api/operation/add').send({
    created: moment.utc('2016-06-05'),
    account: accountToCheck._id,
    category: sample(incomeCategoryList).model._id,
    amount,
  });

  t.is(res.status, 200);
  t.is(res.body.amount, 10.02);
  t.is(res.body.balance, -289.98);
});

test.serial('balance total', async (t) => {
  let res = await request.get('/api/user/profile');

  const userProfile = res.body;
  const { baseCurrency: baseCurrencyId } = userProfile.settings;
  const baseCurrency = currencyList.find(({ _id }) => _id === baseCurrencyId);

  res = await request.get('/api/account/load');

  const { accounts } = res.body;

  res = await request.get('/api/balance/total').query({ date: 'wrong date' });

  t.is(res.status, 400);
  t.is(res.body.error, 'balance.total.error.date.invalid');

  res = await request.get('/api/balance/total').query({ account: 'wrong account' });

  t.is(res.status, 400);
  t.is(res.body.error, 'balance.total.error.account.invalid');

  const accountToCheck = sample(accounts);
  const accountCurrency = currencyList.find(({ _id }) => _id === accountToCheck.currency);
  const valueCheck = accountCurrency.code !== baseCurrency.code
    ? money(accountToCheck.currentBalance)
      .from(accountCurrency.code)
      .to(baseCurrency.code)
    : accountToCheck.currentBalance;

  const fixedValueToCheck = parseFloat(big(valueCheck).toFixed(baseCurrency.decimalDigits));

  res = await request.get('/api/balance/total').query({ account: accountToCheck._id });

  t.is(res.status, 200);
  t.is(res.body.total, fixedValueToCheck);
  t.is(res.body.currency, baseCurrency._id);

  res = await request.get('/api/balance/total').query({
    account: accountToCheck._id,
    date: moment.utc(),
  });

  t.is(res.status, 200);
  t.is(res.body.total, fixedValueToCheck);
  t.is(res.body.currency, baseCurrency._id);

  res = await request.get('/api/balance/total').query({ account: accounts.map(({ _id }) => _id) });

  t.is(res.status, 200);
  t.is(res.body.currency, baseCurrency._id);

  res = await request.get('/api/operation/list');

  res = await request.get('/api/balance/total').query({
    date: moment.utc('2016-05-05').toISOString(),
  });

  t.is(res.status, 200);
  t.is(res.body.total, 76420.05);
});
