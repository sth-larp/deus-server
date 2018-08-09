import { CurrentUser, Get, JsonController } from 'routing-controllers';
import { IAliceAccount } from '../models/alice-account';

@JsonController()
export class AccountController {

  @Get('/account')
  public async get(@CurrentUser() account: IAliceAccount) {
    delete account._rev;
    return { account };
  }
}
