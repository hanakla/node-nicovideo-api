import NicoSession from './NicoSession';
declare var _default: {
    restoreSession(json: object): Promise<NicoSession>;
    restoreFromSessionId(sessionId: string): Promise<NicoSession>;
    login(user: string, password: string): Promise<NicoSession>;
    Nsen: {
        RequestError: {
            NO_LOGIN: string;
            CLOSED: string;
            REQUIRED_TAG: string;
            TOO_LONG: string;
            REQUESTED: string;
        };
        Gage: {
            BLUE: number;
            GREEN: number;
            YELLOW: number;
            ORANGE: number;
            RED: number;
        };
    };
};
export default _default;
export { default as NicoSession } from './NicoSession';
export { default as NicoLive } from './live/NicoLiveApi';
