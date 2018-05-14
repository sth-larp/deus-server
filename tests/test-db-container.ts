import { TSMap } from "typescript-map";

import * as PouchDB from 'pouchdb';
import * as PouchDBUpsert from 'pouchdb-upsert';
PouchDB.plugin(PouchDBUpsert);

import { DatabasesContainer } from "../services/db-container";


export class TestDatabasesContainer extends DatabasesContainer {

  constructor() {
    const eventsDb = new PouchDB('events', { adapter: 'memory' });
    const mobileViewModelDb = new PouchDB('viewmodels_mobile', { adapter: 'memory' });
    const modelDb = new PouchDB('models', { adapter: 'memory' });
    const viewmodelDbs = new TSMap<string, PouchDB.Database<{ timestamp: number }>>([['mobile', mobileViewModelDb]]);
    const accountsDb = new PouchDB('accounts', { adapter: 'memory' });
    const economyDb = new PouchDB('economy', { adapter: 'memory' });
    super(accountsDb, modelDb, viewmodelDbs, eventsDb, economyDb)
  }

  async allEventsSortedByTimestamp(): Promise<any[]> {
    return (await this._eventsDb.allDocs({ include_docs: true })).rows
      .filter((row) => row.id[0] != '_')
      .sort((row1, row2) => (row1.doc ? row1.doc.timestamp : 0) - (row2.doc ? row2.doc.timestamp : 0));
  }

  async destroyDatabases() {
    await this._accountsDb.destroy();
    await this._economyDb.destroy();
    await this._eventsDb.destroy();
    await this._modelsDb.destroy();
    for (const db of this._viewmodelDbs.values())
      await db.destroy();
  }

  public async createViews() {
    await (this.eventsDb() as PouchDB.Database<any>).put({
      _id: '_design/character',
      views: {
        'refresh-events': {
          // tslint:disable-next-line:max-line-length
          map: "function (doc) { if (doc.timestamp && doc.characterId && doc.eventType == '_RefreshModel') emit([doc.characterId, doc.timestamp]);  }",
        },
      },
    });

    await (this.accountsDb() as PouchDB.Database<any>).upsert('_design/account', () => {
      return {
        _id: '_design/account',
        views: {
          'by-login': {
            // tslint:disable-next-line:max-line-length
            map: 'function (doc) { if (doc.login) emit(doc.login);  }',
          },
          'by-push-token': {
            // tslint:disable-next-line:max-line-length
            map: 'function (doc) { if (doc.pushToken) emit(doc.pushToken);  }',
          },
        },
      };
    });

    await (this.viewModelDb('mobile') as PouchDB.Database<any>).upsert('_design/viewmodel', () => {
      return {
        _id: '_design/viewmodel',
        views: {
          'by-timestamp': {
            map: 'function (doc) { if (doc.timestamp) emit(doc.timestamp);  }',
          },
        },
      };
    });

    await (this.modelsDb() as PouchDB.Database<any>).upsert('_design/model', () => {
      return {
        _id: '_design/model',
        views: {
          'by-location': {
            map: 'function (doc) { if (doc.location) emit(doc.location);  }',
          },
        },
      };
    });

    await (this.economyDb() as PouchDB.Database<any>).upsert('_design/economy', () => {
      return {
        _id: '_design/economy',
        views: {
          'by-id': {
            map: 'function (doc) { if (doc.sender && doc.receiver) { emit(doc.sender); emit(doc.receiver); } }',
          },
        },
      };
    });
  }
}

