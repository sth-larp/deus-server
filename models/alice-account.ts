export interface TradeUnions {
    isPilot: boolean;
    isNavigator: boolean;
    isCommunications: boolean;
    isSupercargo: boolean;
    isEngineer: boolean;
    isBiologist: boolean;
    isPlanetolog: boolean;
}

export interface CompanyPosition {
    isTopManager: boolean;
    isSecurity: boolean;
    isManager: boolean;
}

export interface SpecialPositions {
    isJournalist: boolean;
    isIdelogist: boolean;
}

export type Professions = CompanyPosition & SpecialPositions & TradeUnions;

export interface ICompanyAccess {
    isTopManager: boolean;
    companyName: ICompany;
}

export type ICompany = 'gd' | 'pre' | 'kkg' | 'mat' | 'mst';

export interface IAliceAccount {
    _id: string;
    _rev?: string;
    password: string;
    login: string;
    professions: Professions;
    companyAccess: ICompanyAccess[];

    jobs: {
        tradeUnion: TradeUnions;
        companyBonus: ICompany[];
    };

    access?: AccessEntry[];
    pushToken?: string;
    roles?: string[];
}

export interface AccessEntry {
    id: string;
    timestamp: number;
  }
