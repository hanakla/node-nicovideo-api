export interface MylistSummary {
    /** マイリストID */
    id: number|'home'
    /** マイリストの説明 */
    description: string
    /** ユーザー番号 */
    userId: number
    /** 標準のソート方法（？） */
    defaultSort: number
    /** ソート方式（？） */
    sortOrder: number
    /** マイリストのアイコンID */
    iconId: number
    /** リスト名 */
    name: string
    /** 公開マイリストかどうか */
    public: boolean
    /** マイリストの作成日 */
    createTime: Date
    /** マイリストの更新日 */
    updateTime: Date
}

export interface HomeListSummary {
    id: 'home',
    name: string,
    public : boolean
}
