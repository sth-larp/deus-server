import { JsonController, Get, CurrentUser, Param, Post, Body, UnauthorizedError } from "routing-controllers";
import { canonicalId, currentTimestamp, returnCharacterNotFoundOrRethrow, canonicalIds, AccessPropagation, checkAccess } from "../utils";
import { DatabasesContainerToken, Account } from "../services/db-container";
import { Container } from "typedi";
import * as PouchDB from 'pouchdb';
import * as PouchDBUpsert from 'pouchdb-upsert';
import { ApplicationSettingsToken } from "../services/settings";
PouchDB.plugin(PouchDBUpsert);


interface ChangeAccessRightRequest {
  grantAccess?: string[],
  removeAccess?: string[],
}

@JsonController()
export class CharactersController {
  @Get("/characters/:id")
  async get( @CurrentUser() user: Account, @Param("id") id: string) {
    const dbContainer = Container.get(DatabasesContainerToken);
    try {
      id = await canonicalId(id);
      await checkAccess(user, id, AccessPropagation.NoPropagation);
      const allowedAccess = await dbContainer.accountsDb().get(id);
      const access = allowedAccess.access ? allowedAccess.access : [];
      return { access };
    } catch (e) {
      returnCharacterNotFoundOrRethrow(e);
    }
  }

  @Post("/characters/:id")
  async post( @CurrentUser() user: Account, @Param("id") id: string, @Body() req: ChangeAccessRightRequest) {
    const dbContainer = Container.get(DatabasesContainerToken);
    try {
      id = await canonicalId(id);
      await checkAccess(user, id, AccessPropagation.NoPropagation);

      const grantAccess = await canonicalIds(req.grantAccess);
      const removeAccess = await canonicalIds(req.removeAccess);

      const resultAccess: any[] = [];
      await dbContainer.accountsDb().upsert(id, (doc) => {
        const accessGrantTime = Container.get(ApplicationSettingsToken).accessGrantTime;
        doc.access = doc.access ? doc.access : [];
        for (const access of doc.access) {
          if (removeAccess.some((removeId) => access.id == removeId))
            continue;

          if (grantAccess.some((grantId) => access.id == grantId))
            access.timestamp = Math.max(access.timestamp, currentTimestamp() + accessGrantTime);

          resultAccess.push(access);
        }
        for (const access of grantAccess)
          if (!resultAccess.some((r) => r.id == access))
            resultAccess.push({ id: access, timestamp: currentTimestamp() + accessGrantTime });
        doc.access = resultAccess;
        return doc;
      });
      return { access: resultAccess };
    } catch (e) {
      returnCharacterNotFoundOrRethrow(e);
    }
  }
}
