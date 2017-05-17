export interface LiveMetaData {
    /** 配信データ */
    stream: {
        /** 放送ID */
        liveId: string
        /** 放送タイトル */
        title: string
        /** 放送の説明 */
        description: string

        /** 視聴数 */
        watchCount: number
        /** コメント数 */
        commentCount: number

        /** 生放送の時間の関わる計算の"元になる時間" */
        baseTime: Date
        /** 放送の開始時刻 */
        startTime: Date
        /** 放送の開場時間 */
        openTime: Date
        /** 放送の終了時刻（放送中であれば終了予定時刻） */
        endTime: Date

        /** 公式配信か */
        isOfficial: boolean

        /** サブ画面などの配信情報 */
        contents: {
            /** メイン画面かサブ画面か */
            id: string
            /** 再生開始時間 */
            startTime: Date
            /** 音声が無効にされているか */
            disableAudio: boolean
            /** 映像が無効にされているか */
            disableVideo: boolean
            /** 再生されているコンテンツの長さ（秒数） */
            duration: number|null
            /** 再生されているコンテンツのタイトル */
            title: string|null
            /** 再生されているコンテンツのアドレス（動画の場合は"smile:動画ID"） */
            content: string
        }[]
    }

    /** 配信者データ */
    owner: {
        /** ユーザーID */
        userId: number
        /** ユーザー名 */
        name: string
    }

    /** 自分自身の情報 */
    user: {
        /** ユーザーID */
        id: number
        /** ユーザー名 */
        name: string
        /** プレミアムアカウントか */
        isPremium: boolean
    }

    /** RTMPサーバに関するデータ */
    rtmp: {
        isFms: boolean
        port: number
        url:string
        ticket: string
    }

    /** コメントサーバーの情報 */
    comment: {
        /** サーバーアドレス */
        addr: string
        /** サーバーポート */
        port: number
        /** この放送と対応するスレッドID */
        thread: number
    }
}
