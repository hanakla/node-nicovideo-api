export interface MylistItem {
    /** マイリスト項目ID */
    id: number
    /** 項目の種類（動画、静画など） */
    type: number
    /** マイリストコメント */
    description: string
    /** 追加日 */
    createTime: Date
    /** 更新日（？） */
    updateTime: Date
    /** 不明 */
    watch: number

    /** 動画情報 */
    movie          : {
        /** 動画ID*/
        id: string
        /** 動画タイトル*/
        title: string
        /** 動画の長さ（秒）*/
        length: number
        /** サムネイル画像のURL*/
        thumbnail: string

        /** 不明*/
        groupType: string
        /** 最近投稿されたコメントの一部*/
        lastResponse: string
        /** 削除されているか*/
        isDeleted: boolean

        /** この情報の最終更新日時（？）*/
        updateTime: Date
        /** 動画投稿日*/
        firtsRetrieve: Date

        count: {
            /** 再生数 */
            view: number
            /** コメント数 */
            comments: number
            /** マイリスト数 */
            mylist: number
        }
    }
}
