import { TSMap } from "typescript-map";
import * as PouchDB from 'pouchdb';

import { DatabasesContainer } from "../services/db-container";


export class TestDatabasesContainer extends DatabasesContainer {
  
  constructor() {
    const eventsDb = new PouchDB('events', { adapter: 'memory' });
    const mobileViewModelDb = new PouchDB('viewmodel_mobile', { adapter: 'memory' });
    const defaultViewModelDb = new PouchDB('viewmodel_default', { adapter: 'memory' });
    const viewmodelDbs = new TSMap<string, PouchDB.Database<{ timestamp: number }>>
      ([['mobile', mobileViewModelDb],
      ['default', defaultViewModelDb]]);
    const accountsDb = new PouchDB('accounts', { adapter: 'memory' });
    const economyDb = new PouchDB('economy', { adapter: 'memory' });
    super(eventsDb, viewmodelDbs, accountsDb, economyDb)
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
    for (const db of this._viewmodelDbs.values())
      await db.destroy();
  }    
}