import { JsonMember, JsonObject } from 'typedjson';

@JsonObject
export class CheckForInactivitySettings {
  // Once per that time we will query all "inactive" users and notify them
  @JsonMember({isRequired: true, type: Number})
  public performOncePerMs: number;

  // Users for which currentTimestamp - viewModel.timestamp > notifyIfInactiveForMoreThanMs
  // are considered inactive
  @JsonMember({isRequired: true, type: Number})
  public notifyIfInactiveForMoreThanMs: number;

  // If set, check will be performed only
  // when Date().getHours() (returns current hour of day, from 0 to 23)
  // is greater than allowFromHour
  @JsonMember({type: Number})
  public allowFromHour?: number;

  // If set, check will be performed only
  // when Date().getHours() (returns current hour of day, from 0 to 23)
  // is lesser than allowToHour
  @JsonMember({type: Number})
  public allowToHour?: number;
}

@JsonObject
export class PushSettings {
  // Users of push-related methods must use HTTP Basic Auth with following credentials:
  // Username to access push-related methods
  @JsonMember({isRequired: true, type: String})
  public username: string;

  // Password to access push-related methods
  @JsonMember({isRequired: true, type: String})
  public password: string;

  // Firebase Cloud Messaging server key to send push notifications
  @JsonMember({isRequired: true, type: String})
  public serverKey: string;

  // Settings for sending hidden (background) push notification
  // forcing _RefreshModel event sending
  @JsonMember({type: CheckForInactivitySettings})
  public autoRefresh?: CheckForInactivitySettings;

  // Settings for sending visible (and audible if possible) push notification
  // for user to see.
  @JsonMember({type: CheckForInactivitySettings})
  public autoNotify?: CheckForInactivitySettings;

  // Title for notification triggered by autoNotify.
  // If not set - no notification will be sent!
  @JsonMember({type: String})
  public autoNotifyTitle?: string;

  // Body for notification triggered by autoNotify.
  // If not set - empty one will be used
  @JsonMember({type: String})
  public autoNotifyBody?: string;
}

@JsonObject
export class ApplicationSettings {
  // If model server has not put updated viewmodel to DB
  // during this period, we send 202 to user.
  @JsonMember({isRequired: true, type: Number})
  public viewmodelUpdateTimeout: number;

  // Time for which access is granted by /characters method
  @JsonMember({isRequired: true, type: Number})
  public accessGrantTime: number;

  // _RefreshModel events with timestamp > currentTimestamp + tooFarInFutureFilterTime
  // will be ignored
  @JsonMember({isRequired: true, type: Number})
  public tooFarInFutureFilterTime: number;

  // Settings for push notifications
  @JsonMember({isRequired: true, type: PushSettings})
  public pushSettings: PushSettings;
}

@JsonObject
export class ViewModelDbSettings {
  // ViewModel type, e.g. default, mobile, ...
  @JsonMember({isRequired: true, type: String})
  public type: string;

  // URL to access DB
  @JsonMember({isRequired: true, type: String})
  public url: string;
}

@JsonObject
export class DatabasesSettings {
  // Username to access databases
  @JsonMember({isRequired: true, type: String})
  public username: string;

  // Password to access databases
  @JsonMember({isRequired: true, type: String})
  public password: string;

  // URL to access accounts DB
  @JsonMember({isRequired: true, type: String})
  public accounts: string;

  // URL to access events DB
  @JsonMember({isRequired: true, type: String})
  public events: string;

  // URL to access events DB
  @JsonMember({type: Number})
  public compactEventsViewEveryMs?: number

  // Settings for ViewModel databases
  @JsonMember({isRequired: true, elements: ViewModelDbSettings})
  public viewModels: ViewModelDbSettings[];
}

@JsonObject
export class Configuration {
  // Port to listen on
  @JsonMember({isRequired: true, type: Number})
  public port: number;

  // Settings for databases access
  @JsonMember({isRequired: true, type: DatabasesSettings})
  public databases: DatabasesSettings;

  // Inner application settings
  @JsonMember({isRequired: true, type: ApplicationSettings})
  public settings: ApplicationSettings;
}
