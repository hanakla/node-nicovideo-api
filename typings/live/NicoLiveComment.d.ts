export default class NicoLiveComment {
    static AccountTypes: any;
    /**
     * 規定の形式のXMLからNicoLiveCommentモデルを生成します。
     *
     * ニコ生サーバーから配信されてくる以下のような形式のコメント（１行）を第１引数に渡してください。
     *   <chat thread="##" vpos="##" date="##" date_usec="##" user_id="##" premium="#" locale="**">コメント内容</chat>
     *
     * @param {String} xml ニコ生コメントサーバーから受信したXMLコメントデータ
     * @param {Number} loggedUserId 現在ログイン中のユーザーのID
     * @return {NicoLiveComment}
     */
    static fromRawXml(xml: any, loggedUserId: any): NicoLiveComment;
    constructor(_attr: any);
    get(path: any): any;
    isNormalComment(): boolean;
    isControlComment(): boolean;
    isPostByDistributor(): boolean;
    isPostBySelf(): any;
    isPostByAnonymous(): any;
    isPostByPremiumUser(): any;
}
