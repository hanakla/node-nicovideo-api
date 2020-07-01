export interface LiveComment {
  /** コメントサーバー内のスレッドID */
  threadId: string;

  /** コメント投稿日時 */
  date: Date;
  /** 投稿元国情報("ja-jp", "jp"など、詳細不明) */
  locale: string | undefined;
  /** コメント投稿時に設定されたコマンド(184など) */
  command: string | undefined;
  /** コメント */
  comment: string;
  /** ？ */
  vpos: number;

  /** 自分で投稿したコメントか */
  isMyPost: boolean;

  /** 投稿したユーザー情報 */
  user: {
    /** ユーザー番号(匿名コメントの場合は文字列） */
    id: number | string;
    /** このユーザーのNGスコア */
    score: number;
    /** アカウント種別(0:一般, 1:プレミアム, 3:配信者) */
    accountType: number;
    /** プレミアム会員かどうか */
    isPremium: boolean;
    /** 匿名コメントかどうか */
    isAnonymous: boolean;
  };
}
