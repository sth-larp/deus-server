import * as basic_auth from 'basic-auth';
import * as bodyparser from 'body-parser';
import * as express from 'express';
import * as addRequestId from 'express-request-id';
import * as time from 'express-timestamp';
import * as http from 'http';
import * as PouchDB from 'pouchdb';
import * as PouchDBFind from 'pouchdb-find';
PouchDB.plugin(PouchDBFind);

import 'reflect-metadata'; // this shim is required
import { Action, UnauthorizedError, useExpressServer } from 'routing-controllers';
import { Container } from 'typedi';
import { StatusAndBody } from './connection';
import { AccountController } from './controllers/account.controller';
import { CharactersController } from './controllers/characters.controller';
import { EconomyController } from './controllers/economy.controller';
import { EventsController } from './controllers/events.controller';
import { LocationEventsController } from './controllers/location-events.controller';
import { MedicController } from './controllers/medic.controller';
import { PushController } from './controllers/push.controller';
import { TimeController } from './controllers/time.controller';
import { ViewModelController } from './controllers/viewmodel.controller';
import { LoggingErrorHandler } from './middleware/error-handler';
import { makeSilentRefreshNotificationPayload, makeVisibleNotificationPayload,
  sendGenericPushNotification } from './push-helpers';
import { DatabasesContainerToken } from './services/db-container';
import { LoggerToken } from './services/logger';
import { ApplicationSettingsToken } from './services/settings';
import { canonicalId, currentTimestamp, RequestId, returnCharacterNotFoundOrRethrow } from './utils';

import { AliceAccount } from './models/alice-account';
import { ShipsController } from './controllers/ships.controller';

class App {
  private app: express.Express = express();
  private server: http.Server | null = null;
  private cancelAutoNotify: NodeJS.Timer | null = null;
  private cancelAutoRefresh: NodeJS.Timer | null = null;
  private logger = Container.get(LoggerToken);
  private dbContainer = Container.get(DatabasesContainerToken);
  private settings = Container.get(ApplicationSettingsToken);

  constructor() {
    this.app.use(addRequestId());
    this.app.use(time.init);
    this.app.use(bodyparser.json());

    this.app.use((req, res, next) => {
      this.logger.debug('Request body',
        { requestId: RequestId(req), body: req.body, originalUrl: req.originalUrl, ip: req.ip, source: 'api' });
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
      next();
    });

    useExpressServer(this.app, {
      currentUserChecker: async (action: Action): Promise<AliceAccount | undefined> => {
        const credentials = basic_auth(action.request);
        if (!credentials)
          throw new UnauthorizedError('No authorization provided');

        try {
          credentials.name = await canonicalId(credentials.name);
          const account = await this.dbContainer.accountsDb().get(credentials.name);
          if (account.password != credentials.pass)
            throw new UnauthorizedError('Wrong password');
          return account;
        } catch (e) {
          returnCharacterNotFoundOrRethrow(e);
        }
      },
      controllers: [
        TimeController, ViewModelController, CharactersController, PushController, EventsController, EconomyController,
        LocationEventsController, MedicController, AccountController, ShipsController,
      ],
      middlewares: [LoggingErrorHandler],
      cors: true,
    });

    const deleteMeLogFn = (id: string, result: Promise<StatusAndBody>) => {
      result.then((r) => this.logger.info(
        `Sending push notification to force refresh`, { r, characterId: id, source: 'api' }))
        .catch((err) => this.logger.warn(`Failed to send notification: ${err}`, { characterId: id, source: 'api' }));
    };

    if (this.settings.pushSettings.autoNotify && this.settings.pushSettings.autoNotifyTitle) {
      const autoNotifySettings = this.settings.pushSettings.autoNotify;
      const autoNotifyTitle = this.settings.pushSettings.autoNotifyTitle;
      this.cancelAutoNotify = setInterval(async () => {
        const currentHour = new Date().getHours();
        if (autoNotifySettings.allowFromHour && autoNotifySettings.allowFromHour > currentHour)
          return;
        if (autoNotifySettings.allowToHour && autoNotifySettings.allowToHour < currentHour)
          return;
        try {
          const inactiveIDs =
            await this.getCharactersInactiveForMoreThan(autoNotifySettings.notifyIfInactiveForMoreThanMs);
          inactiveIDs.map((id) => deleteMeLogFn(id, sendGenericPushNotification(id,
            makeVisibleNotificationPayload(autoNotifyTitle, this.settings.pushSettings.autoNotifyBody))));
        } catch (e) {
          this.logger.error(`Error when getting inactive users: ${e}`, { source: 'api' });
        }
      }, autoNotifySettings.performOncePerMs);
    }

    if (this.settings.pushSettings.autoRefresh) {
      const autoRefreshSettings = this.settings.pushSettings.autoRefresh;
      this.cancelAutoRefresh = setInterval(async () => {
        const currentHour = new Date().getHours();
        if (autoRefreshSettings.allowFromHour && autoRefreshSettings.allowFromHour > currentHour)
          return;
        if (autoRefreshSettings.allowToHour && autoRefreshSettings.allowToHour < currentHour)
          return;
        try {
          const inactiveIDs =
            await this.getCharactersInactiveForMoreThan(autoRefreshSettings.notifyIfInactiveForMoreThanMs);
          inactiveIDs.map((id) => deleteMeLogFn(id, sendGenericPushNotification(id,
            makeSilentRefreshNotificationPayload())));
        } catch (e) {
          this.logger.error(`Error when getting inactive users: ${e}`, { source: 'api' });
        }
      }, autoRefreshSettings.performOncePerMs);
    }
  }

  public async listen() {
    this.server = this.app.listen(this.settings.port);
  }

  public stop() {
    if (!this.server) return;
    this.server.close();
    if (this.cancelAutoNotify) {
      clearInterval(this.cancelAutoNotify);
    }
    if (this.cancelAutoRefresh) {
      clearInterval(this.cancelAutoRefresh);
    }
  }

  private async getCharactersInactiveForMoreThan(ms: number): Promise<string[]> {
    const docs = await this.dbContainer.viewModelDb('mobile').find({
      selector: { timestamp: { $lt: currentTimestamp() - ms } },
    });

    return docs.docs.map((doc) => doc._id);
  }
}

export default App;
