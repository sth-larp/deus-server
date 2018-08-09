import { expect } from 'chai';
import 'mocha';
import * as rp from 'request-promise';
import { ProvisionRequest } from '../../services/db-container';

export function getCreateAccountTest(address: string) {
describe('Create account', () => {

    it('Can create account', async () => {
        const provisionBody: ProvisionRequest = {
            initialBalance: 1000,
            userId: '00003',
        };

        const response = await rp.post(address + '/economy/provision',
        {
          resolveWithFullResponse: true,
          json: provisionBody,
          auth: { username: 'admin', password: 'admin' },
        }).promise();
      expect(response.statusCode).to.eq(200);

      const responseBalance = await rp.get(address + '/economy/00003',
      {
        resolveWithFullResponse: true, json: {},
        auth: { username: 'withoutbalance', password: '3' },
      }).promise();
        expect(responseBalance.statusCode).to.eq(200);
        expect(responseBalance.body.balance).to.deep.equal(1000);
    });

    it('Can create account twice', async () => {
        const provisionBody: ProvisionRequest = {
            initialBalance: 1000,
            userId: '00003',
        };

        const response = await rp.post(address + '/economy/provision',
        {
          resolveWithFullResponse: true,
          json: provisionBody,
          auth: { username: 'admin', password: 'admin' },
        }).promise();
      expect(response.statusCode).to.eq(200);

      provisionBody.initialBalance = 500;

      const response2 = await rp.post(address + '/economy/provision',
      {
        resolveWithFullResponse: true,
        json: provisionBody,
        auth: { username: 'admin', password: 'admin' },
      }).promise();
        expect(response2.statusCode).to.eq(200);

      const responseBalance = await rp.get(address + '/economy/00003',
      {
        resolveWithFullResponse: true, json: {},
        auth: { username: 'withoutbalance', password: '3' },
      }).promise();
        expect(responseBalance.statusCode).to.eq(200);
        expect(responseBalance.body.balance).to.deep.equal(500);
    });

    it('Only admins could provide account', async () => {
        const provisionBody: ProvisionRequest = {
            initialBalance: 1000,
            userId: '00003',
        };

        const response = await rp.post(address + '/economy/provision',
        {
          resolveWithFullResponse: true,
          json: provisionBody,
          auth: { username: 'withoutbalance', password: '3' },
          simple: false,
        }).promise();
      expect(response.statusCode).to.eq(401);
    });

    it('Get 404 if user does not exist', async () => {
        const provisionBody: ProvisionRequest = {
            initialBalance: 1000,
            userId: '101010',
        };

      const response = await rp.post(address + '/economy/provision',
        {
          resolveWithFullResponse: true, simple: false,
          json: provisionBody,
          auth: { username: 'admin', password: 'admin' },
        }).promise();
      expect(response.statusCode).to.eq(404);
    });
  });
}
