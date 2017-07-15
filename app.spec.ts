import * as PouchDB from 'pouchdb';
import * as rp from 'request-promise';
// tslint:disable-next-line:no-var-requires
PouchDB.plugin(require('pouchdb-adapter-memory'));
import * as winston from 'winston';

import { expect } from 'chai';
import 'mocha';

import { TSMap } from 'typescript-map';
import App from './app';

const port = 3000;
const address = 'http://localhost:' + port;

describe('API Server', () => {
  let app: App;
  let eventsDb: PouchDB.Database<{ characterId: string, eventType: string, timestamp: number, data: any }>;
  let mobileViewModelDb: PouchDB.Database<{ timestamp: number, updatesCount: number }>;
  let defaultViewModelDb: PouchDB.Database<{ timestamp: number, updatesCount: number }>;
  let accountsDb: PouchDB.Database<{ password: string }>;

  beforeEach(async () => {
    eventsDb = new PouchDB('events', { adapter: 'memory' });
    mobileViewModelDb = new PouchDB('viewmodel_mobile', { adapter: 'memory' });
    defaultViewModelDb = new PouchDB('viewmodel_default', { adapter: 'memory' });
    const viewmodelDbs = new TSMap<string, PouchDB.Database<{ timestamp: number }>>
      ([['mobile', mobileViewModelDb],
      ['default', defaultViewModelDb]]);
    accountsDb = new PouchDB('accounts', { adapter: 'memory' });
    const logger = new winston.Logger({ level: 'warning' });
    app = new App(logger, eventsDb, viewmodelDbs, accountsDb, 20);
    await app.listen(port);
    await mobileViewModelDb.put({
      _id: 'some_user', timestamp: 420,
      updatesCount: 0, mobile: true,
    });
    await defaultViewModelDb.put({
      _id: 'some_user', timestamp: 420,
      updatesCount: 0, mobile: false,
    });
    await accountsDb.put({ _id: 'some_user', password: 'qwerty' });
    await accountsDb.put({ _id: 'user_without_model', password: 'hunter2' });
  });

  afterEach(async () => {
    app.stop();
    await accountsDb.destroy();
    await mobileViewModelDb.destroy();
    await defaultViewModelDb.destroy();
    await eventsDb.destroy();
  });

  describe('/time', () => {
    it('Returns approximately current time', async () => {
      const response = await rp.get(address + '/time',
        { resolveWithFullResponse: true, json: { events: [] } }).promise();
      expect(response.statusCode).to.eq(200);
      expect(response.headers['content-type']).to.equal('application/json; charset=utf-8');
      expect(response.body.serverTime).to.be.approximately(new Date().valueOf(), 1000);
    });
  });

  describe('GET /viewmodel', () => {

    it('Returns mobile viewmodel of existing character if mobile type is provided', async () => {
      const response = await rp.get(address + '/viewmodel/some_user?type=mobile',
        {
          resolveWithFullResponse: true, json: {},
          auth: { username: 'some_user', password: 'qwerty' },
        }).promise();
      expect(response.statusCode).to.eq(200);
      expect(response.headers['content-type']).to.equal('application/json; charset=utf-8');
      expect(response.body.serverTime).to.be.approximately(new Date().valueOf(), 1000);
      expect(response.body.id).to.equal('some_user');
      expect(response.body.viewModel).to.deep.equal({ timestamp: 420, updatesCount: 0, mobile: true });
    });

    it('Returns default viewmodel of existing character if no type provided', async () => {
      const response = await rp.get(address + '/viewmodel/some_user',
        {
          resolveWithFullResponse: true, json: {},
          auth: { username: 'some_user', password: 'qwerty' },
        }).promise();
      expect(response.statusCode).to.eq(200);
      expect(response.headers['content-type']).to.equal('application/json; charset=utf-8');
      expect(response.body.serverTime).to.be.approximately(new Date().valueOf(), 1000);
      expect(response.body.id).to.equal('some_user');
      expect(response.body.viewModel).to.deep.equal({ timestamp: 420, updatesCount: 0, mobile: false });
    });

    it('Returns 404 for non-existent viewmodel type', async () => {
      const response = await rp.get(address + '/viewmodel/some_user?type=foo',
        {
          resolveWithFullResponse: true, simple: false, json: {},
          auth: { username: 'some_user', password: 'qwerty' },
        }).promise();
      expect(response.statusCode).to.eq(404);
    });

    it('Returns 404 for сharacter not existing in accounts DB', async () => {
      const response = await rp.get(address + '/viewmodel/4444',
        {
          resolveWithFullResponse: true, simple: false, json: {},
          auth: { username: '4444', password: '4444' },
        }).promise();
      expect(response.statusCode).to.eq(404);
    });

    it('Returns 404 for сharacter existing accounts DB, but not viewmodel DB', async () => {
      const response = await rp.get(address + '/viewmodel/user_without_model',
        {
          resolveWithFullResponse: true, simple: false, json: {},
          auth: { username: 'user_without_model', password: 'hunter2' },
        }).promise();
      expect(response.statusCode).to.eq(404);
    });

    it('Returns 401 and WWW-Authenticate if no credentials ', async () => {
      const response = await rp.get(address + '/viewmodel/some_user',
        {
          resolveWithFullResponse: true, simple: false, json: {},
        }).promise();
      expect(response.statusCode).to.eq(401);
      expect(response.headers['WWW-Authenticate']).not.to.be.null;
    });

    it('Returns 401 and WWW-Authenticate if wrong credentials ', async () => {
      const response = await rp.get(address + '/viewmodel/some_user',
        {
          resolveWithFullResponse: true, simple: false, json: {},
          auth: { username: 'some_user', password: 'wrong one' },
        }).promise();
      expect(response.statusCode).to.eq(401);
      expect(response.headers['WWW-Authenticate']).not.to.be.null;
    });

    it('Returns 401 and WWW-Authenticate if querying another user ', async () => {
      const response = await rp.get(address + '/viewmodel/some_user',
        {
          resolveWithFullResponse: true, simple: false, json: {},
          auth: { username: 'user_without_model', password: 'hunter2' },
        }).promise();
      expect(response.statusCode).to.eq(401);
      expect(response.headers['WWW-Authenticate']).not.to.be.null;
    });
  });

  describe('POST /events', () => {
    it('Returns 400 if no events field present', async () => {
      const response = await rp.post(address + '/events/some_user',
        {
          resolveWithFullResponse: true, simple: false, json: { foo: 'bar' },
          auth: { username: 'some_user', password: 'qwerty' },
        }).promise();
      expect(response.statusCode).to.eq(400);
    });

    it('Returns 400 if events field is not an array', async () => {
      const response = await rp.post(address + '/events/some_user',
        {
          resolveWithFullResponse: true, simple: false, json: { events: { foo: 'bar' } },
          auth: { username: 'some_user', password: 'qwerty' },
        }).promise();
      expect(response.statusCode).to.eq(400);
    });

    it('Returns 404 for сharacter not existing in accounts DB', async () => {
      const response = await rp.post(address + '/events/4444',
        {
          resolveWithFullResponse: true, simple: false, json: { events: [] },
          auth: { username: '4444', password: '4444' },
        }).promise();
      expect(response.statusCode).to.eq(404);
    });

    it('Returns 404 for сharacter existing accounts DB, but not viewmodel DB', async () => {
      const response = await rp.post(address + '/events/user_without_model',
        {
          resolveWithFullResponse: true, simple: false, json: { events: [] },
          auth: { username: 'user_without_model', password: 'hunter2' },
        }).promise();
      expect(response.statusCode).to.eq(404);
    });

    it('Returns 401 and WWW-Authenticate if no credentials ', async () => {
      const response = await rp.post(address + '/events/some_user',
        {
          resolveWithFullResponse: true, simple: false, json: {},
        }).promise();
      expect(response.statusCode).to.eq(401);
      expect(response.headers['WWW-Authenticate']).not.to.be.null;
    });

    it('Returns 401 and WWW-Authenticate if wrong credentials ', async () => {
      const response = await rp.post(address + '/events/some_user',
        {
          resolveWithFullResponse: true, simple: false, json: {},
          auth: { username: 'some_user', password: 'wrong one' },
        }).promise();
      expect(response.statusCode).to.eq(401);
      expect(response.headers['WWW-Authenticate']).not.to.be.null;
    });

    it('Returns 401 and WWW-Authenticate if querying another user ', async () => {
      const response = await rp.post(address + '/events/some_user',
        {
          resolveWithFullResponse: true, simple: false, json: {},
          auth: { username: 'user_without_model', password: 'hunter2' },
        }).promise();
      expect(response.statusCode).to.eq(401);
      expect(response.headers['WWW-Authenticate']).not.to.be.null;
    });

    it('Sets proper header', async () => {
      const response = await rp.post(address + '/events/some_user',
        {
          resolveWithFullResponse: true, json: { events: [] },
          auth: { username: 'some_user', password: 'qwerty' },
        }).promise();
      expect(response.statusCode).to.eq(202);
      expect(response.headers['content-type']).to.equal('application/json; charset=utf-8');
    });

    it('Puts event into db', async () => {
      const event = {
        eventType: '_RefreshModel',
        timestamp: 4365,
        data: { foo: 'ambar' },
      };
      const response = await rp.post(address + '/events/some_user',
        {
          resolveWithFullResponse: true, json: { events: [event] },
          auth: { username: 'some_user', password: 'qwerty' },
        }).promise();

      expect(response.statusCode).to.eq(202);
      const docs = await eventsDb.query('web_api_server_v2/characterId_timestamp_mobile', { include_docs: true });
      expect(docs.rows.length).to.equal(1);
      const doc: any = docs.rows[0].doc;
      expect(doc).to.deep.include(event);
      expect(doc).to.deep.include({ characterId: 'some_user' });
    });

    it('Returns viewmodel in case if processed in time', async () => {
      const event = {
        eventType: '_RefreshModel',
        timestamp: 4365,
      };
      eventsDb.changes({ since: 'now', live: true, include_docs: true }).on('change', (change) => {
        if (change.doc) {
          const changeDoc = change.doc;
          mobileViewModelDb.get('some_user').then((doc) => {
            mobileViewModelDb.put({
              _id: 'some_user',
              _rev: doc._rev,
              timestamp: changeDoc.timestamp,
              updatesCount: doc.updatesCount + 1,
            });
          });
        }
      });

      const response = await rp.post(address + '/events/some_user',
        {
          resolveWithFullResponse: true, json: { events: [event] },
          auth: { username: 'some_user', password: 'qwerty' },
        }).promise();
      expect(response.statusCode).to.eq(200);
      expect(response.body.serverTime).to.be.approximately(new Date().valueOf(), 1000);
      expect(response.body.id).to.equal('some_user');
      expect(response.body.viewModel).to.deep.equal({ timestamp: 4365, updatesCount: 1 });
    });

    it('Returns Accepted in case if not processed in time', async () => {
      const event = {
        eventType: 'TestEvent',
        timestamp: 4365,
      };

      const response = await rp.post(address + '/events/some_user',
        {
          resolveWithFullResponse: true, json: { events: [event] },
          auth: { username: 'some_user', password: 'qwerty' },
        }).promise();

      expect(response.statusCode).to.eq(202);
      expect(response.body.serverTime).to.be.approximately(new Date().valueOf(), 1000);
      expect(response.body.id).to.equal('some_user');
      expect(response.body.timestamp).to.equal(4365);
    });

    it('Returns timestamp of latest event successfully saved', async () => {
      const events = [{
        eventType: 'TestEvent',
        timestamp: 4365,
      }, {
        eventType: 'TestEvent',
        timestamp: 6666,
      }];

      const response = await rp.post(address + '/events/some_user',
        {
          resolveWithFullResponse: true, json: { events: events },
          auth: { username: 'some_user', password: 'qwerty' },
        }).promise();

      expect(response.statusCode).to.eq(202);
      expect(response.body.serverTime).to.be.approximately(new Date().valueOf(), 1000);
      expect(response.body.id).to.equal('some_user');
      expect(response.body.timestamp).to.equal(6666);
    });

    it('Handles multiple simultaneous connections from same non-mobile client', async () => {
      const event = {
        eventType: 'TestEvent',
        timestamp: 4365,
      };

      const promises: any[] = [];
      for (let i = 0; i < 100; ++i)
        promises.push(rp.post(address + '/events/some_user',
          {
            resolveWithFullResponse: true, simple: false, json: { events: [event] },
            auth: { username: 'some_user', password: 'qwerty' },
          }).promise());

      const resultStatuses = (await Promise.all(promises)).map((res) => res.statusCode);
      const expectedStatuses = Array(100).fill(202);
      expect(resultStatuses).to.deep.equal(expectedStatuses);
      const res = await eventsDb.allDocs({ include_docs: true });
      const events = res.rows.filter((row) => row.doc && row.doc.characterId);
      expect(events.length).to.eq(100);
    });

    it('Handles multiple sequential connections from same client', async () => {
      const event = {
        eventType: 'TestEvent',
        timestamp: 4365,
      };

      const response1 = await rp.post(address + '/events/some_user',
        {
          resolveWithFullResponse: true, simple: false, json: { events: [event] },
          auth: { username: 'some_user', password: 'qwerty' },
        }).promise();
      const response2 = await rp.post(address + '/events/some_user',
        {
          resolveWithFullResponse: true, simple: false, json: { events: [event] },
          auth: { username: 'some_user', password: 'qwerty' },
        }).promise();
      expect(response1.statusCode).to.eq(202);
      expect(response2.statusCode).to.eq(202);
    });

    it('Deduplicates events with same timestamp', async () => {
      const event = {
        eventType: '_RefreshModel',
        timestamp: 4365,
      };

      const response1 = await rp.post(address + '/events/some_user',
        {
          resolveWithFullResponse: true, simple: false, json: { events: [event] },
          auth: { username: 'some_user', password: 'qwerty' },
        }).promise();
      const response2 = await rp.post(address + '/events/some_user',
        {
          resolveWithFullResponse: true, simple: false, json: { events: [event] },
          auth: { username: 'some_user', password: 'qwerty' },
        }).promise();
      expect(response1.statusCode).to.eq(202);
      expect(response2.statusCode).to.eq(202);

      const res = await eventsDb.allDocs({ include_docs: true });
      // Filter design-docs
      const events = res.rows.filter((row) => row.doc && row.doc.characterId);
      expect(events.length).to.eq(1);
    });

    it('Returns 409 if trying to submit non-mobile event into past', async () => {
      const event = {
        eventType: 'TestEvent',
        timestamp: 100, // < 420
      };

      const response = await rp.post(address + '/events/some_user',
        {
          resolveWithFullResponse: true, simple: false, json: { events: [event] },
          auth: { username: 'some_user', password: 'qwerty' },
        }).promise();
      expect(response.statusCode).to.eq(409);
    });
  });

  describe('GET /events', () => {
    it('Returns 404 for сharacter not existing in accounts DB', async () => {
      const response = await rp.get(address + '/events/4444',
        {
          resolveWithFullResponse: true, simple: false, json: {},
          auth: { username: '4444', password: '4444' },
        }).promise();
      expect(response.statusCode).to.eq(404);
    });

    it('Returns 404 for сharacter existing accounts DB, but not viewmodel DB', async () => {
      const response = await rp.get(address + '/events/user_without_model',
        {
          resolveWithFullResponse: true, simple: false, json: {},
          auth: { username: 'user_without_model', password: 'hunter2' },
        }).promise();
      expect(response.statusCode).to.eq(404);
    });

    it('Returns 401 and WWW-Authenticate if no credentials ', async () => {
      const response = await rp.get(address + '/events/some_user',
        {
          resolveWithFullResponse: true, simple: false, json: {},
        }).promise();
      expect(response.statusCode).to.eq(401);
      expect(response.headers['WWW-Authenticate']).not.to.be.null;
    });

    it('Returns 401 and WWW-Authenticate if wrong credentials ', async () => {
      const response = await rp.get(address + '/events/some_user',
        {
          resolveWithFullResponse: true, simple: false, json: {},
          auth: { username: 'some_user', password: 'wrong one' },
        }).promise();
      expect(response.statusCode).to.eq(401);
      expect(response.headers['WWW-Authenticate']).not.to.be.null;
    });

    it('Returns 401 and WWW-Authenticate if querying another user ', async () => {
      const response = await rp.get(address + '/events/some_user',
        {
          resolveWithFullResponse: true, simple: false, json: {},
          auth: { username: 'user_without_model', password: 'hunter2' },
        }).promise();
      expect(response.statusCode).to.eq(401);
      expect(response.headers['WWW-Authenticate']).not.to.be.null;
    });

    it('Returns timestamp of viewmodel if no events present', async () => {
      const response = await rp.get(address + '/events/some_user',
        {
          resolveWithFullResponse: true, simple: false, json: {},
          auth: { username: 'some_user', password: 'qwerty' },
        }).promise();
      expect(response.statusCode).to.eq(200);
      expect(response.body.id).to.equal('some_user');
      expect(response.body.timestamp).to.equal(420);
      expect(response.body.serverTime).to.be.approximately(new Date().valueOf(), 1000);
    });

    it('Returns timestamp of latest mobile event', async () => {
      const events = [{
        eventType: 'TestEvent',
        timestamp: 4365,
      }, {
        eventType: '_RefreshModel',
        timestamp: 6666,
      }];

      const responsePut = await rp.post(address + '/events/some_user',
        {
          resolveWithFullResponse: true, json: { events: events },
          auth: { username: 'some_user', password: 'qwerty' },
        }).promise();
      expect(responsePut.statusCode).to.eq(202);

      const response = await rp.get(address + '/events/some_user',
        {
          resolveWithFullResponse: true, simple: false, json: {},
          auth: { username: 'some_user', password: 'qwerty' },
        }).promise();
      expect(response.body.id).to.equal('some_user');
      expect(response.body.timestamp).to.equal(6666);
      expect(response.body.serverTime).to.be.approximately(new Date().valueOf(), 1000);
    });
  });
});

describe('API Server - long timeout', () => {
  let app: App;
  let eventsDb: PouchDB.Database<{ characterId: string, eventType: string, timestamp: number, data: any }>;
  let viewModelDb: PouchDB.Database<{ timestamp: number, updatesCount: number }>;
  let accountsDb: PouchDB.Database<{ password: string }>;
  beforeEach(async () => {
    eventsDb = new PouchDB('events2', { adapter: 'memory' });
    viewModelDb = new PouchDB('viewmodel2', { adapter: 'memory' });
    const viewmodelDbs = new TSMap<string, PouchDB.Database<{ timestamp: number }>>([['mobile', viewModelDb]]);
    accountsDb = new PouchDB('accounts2', { adapter: 'memory' });
    const logger = new winston.Logger({ level: 'warning' });
    app = new App(logger, eventsDb, viewmodelDbs, accountsDb, 9000);
    await app.listen(port);
    await viewModelDb.put({ _id: 'some_user', timestamp: 420, updatesCount: 0 });
    await accountsDb.put({ _id: 'some_user', password: 'qwerty' });
  });

  afterEach(async () => {
    app.stop();
    await accountsDb.destroy();
    await viewModelDb.destroy();
    await eventsDb.destroy();
  });

  it('Does not wait for viewmodel update', async () => {
    const event = {
      eventType: 'NonMobile',
      timestamp: 4365,
    };
    const response = await rp.post(address + '/events/some_user',
      {
        resolveWithFullResponse: true, json: { events: [event] },
        auth: { username: 'some_user', password: 'qwerty' },
      }).promise();

    expect(response.statusCode).to.eq(202);
    const res = await eventsDb.allDocs({ include_docs: true });
    const events = res.rows.filter((row) => row.doc && row.doc.characterId);
    expect(events.length).to.eq(1);
    expect(events[0].doc).to.deep.include(event);
    expect(events[0].doc).to.deep.include({ characterId: 'some_user' });
  });
});
