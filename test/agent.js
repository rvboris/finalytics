import http from 'http';
import { agent } from 'supertest-as-promised';
import { app } from '../build/server';

export default async () => {
  const appInstance = await app();
  return agent(http.createServer(appInstance.callback()));
};