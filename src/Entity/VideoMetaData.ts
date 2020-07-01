export interface VideoMetadata {
  /** 動画ID */
  id: string;
  /** 動画タイトル */
  title: string;
  /** 動画説明文 */
  description: string;

  /** 動画の長さ（秒） */
  length: number;
  /** 動画ファイルの形式(mp4, flv, swf) */
  movieType: string;
  /** サムネイル画像のURL */
  thumbnail: string;
  /** 削除されているか（現在、常にfalse） */
  isDeleted: boolean;

  /** 統計情報 */
  stats: {
    /** 再生数 */
    view: number;
    /** コメント数 */
    comments: number;
    /** マイリスト数 */
    mylist: number;
  };

  /** タグ情報 */
  tags: {
    /** タグ名 */
    name: string;
    /** カテゴリタグか */
    isCategory: boolean;
    /** ロックされているか */
    isLocked: boolean;
    /** どの国のタグか（日本="jp"） */
    domain: string;
  }[];

  /** 投稿者情報 */
  user: {
    /** ユーザーID */
    id: string;
    /** ユーザー名 */
    name: string;
    /** ユーザーアイコンのURL */
    icon: string;
  };
}
