import * as PouchDB from 'pouchdb';
import * as PouchDBUpsert from 'pouchdb-upsert';
PouchDB.plugin(PouchDBUpsert);

import { JsonController, Post, CurrentUser, Body, BadRequestError, Get, Param } from "routing-controllers";
import { Container } from "typedi";

import { DatabasesContainerToken, TransactionRequest, BalancesDocument } from "../services/db-container";
import { returnCharacterNotFoundOrRethrow, canonicalId, checkAccess, currentTimestamp } from "../utils";


@JsonController()
export class EconomyController {
  @Post("/economy/transfer")
  async transfer(@CurrentUser() user: string, @Body() body: TransactionRequest) {
    try {
      body.sender = await canonicalId(body.sender);
      await checkAccess(user, body.sender);
      body.receiver = await canonicalId(body.receiver);
      if (body.amount <= 0)
        throw new BadRequestError("Transaction amount should be positive.")
      if (body.sender == body.receiver)
        throw new BadRequestError("Can't transfer to yourself.")

      const db = Container.get(DatabasesContainerToken).economyDb();
      await db.upsert("balances", (doc) => {
        if (doc[body.sender] < body.amount)
          throw new BadRequestError("Not enough money")
        doc[body.sender] -= body.amount;
        doc[body.receiver] += body.amount;
        return doc;
      });
      await db.post({
        sender: body.sender,
        receiver: body.receiver,
        amount: body.amount,
        timestamp: currentTimestamp(),
      });
    }
    catch (e) {
      returnCharacterNotFoundOrRethrow(e);
    }
  }

  @Get("/economy/:id")
  async get(@CurrentUser() user: string, @Param("id") id: string){
    id = await canonicalId(id);
    await checkAccess(user, id);
    const db = Container.get(DatabasesContainerToken).economyDb();
    const doc = await db.get('balances') as BalancesDocument;
    return { balance: doc[id] || 0 };
  }
}