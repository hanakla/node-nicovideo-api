#
# ニコニコ動画APIのURLを定義しています。
#

exports.Auth =
    # POST : mail_tel, password
    LOGIN       : "https://secure.nicovideo.jp/secure/login?site=niconico"

    # GET
    LOGOUT      : "https://secure.nicovideo.jp/secure/logout"

    # GET
    LOGINTEST   : "http://live.nicovideo.jp/api/getplayerstatus/nsen/vocaloid"

exports.Live =
    #  URL + 放送ID
    GET_PLAYER_STATUS: "http://live.nicovideo.jp/api/getplayerstatus/%s"

    #  パラメータ: コメントスレッドID
    GET_POSTKEY: "http://live.nicovideo.jp/api/getpostkey?thread=%s"

    #  パラメータ: 放送ID, 動画ID
    NSEN_REQUEST: "http://live.nicovideo.jp/api/nsenrequest?v=%s&id=%s"
    #  パラメータ: 放送ID
    NSEN_REQUEST_CANCEL: "http://live.nicovideo.jp/api/nsenrequest?v=%s&mode=cancel"
    #  パラメータ: 放送ID
    NSEN_REQUEST_SYNC: "http://live.nicovideo.jp/api/nsenrequest?v=%s&mode=requesting"
    #  パラメータ: 放送ID
    NSEN_GOOD: "http://ow.live.nicovideo.jp/api/nsengood?v=%s"
    #  パラメータ: 放送ID
    NSEN_SKIP: "http://ow.live.nicovideo.jp/api/nsenskip?v=%s"


exports.Video =
    #  URL + 動画ID
    GET_VIDEO_INFO: "http://ext.nicovideo.jp/api/getthumbinfo/%s"

exports.MyList =
    FETCH_TOKEN: "http://www.nicovideo.jp/my/mylist"
    GET_GROUPS: "http://www.nicovideo.jp/api/mylistgroup/list"

    DefList :
        LIST: "http://www.nicovideo.jp/api/deflist/list"

        #  フォームデータ: item_type, item_id, token, ?description
        ADD: "http://www.nicovideo.jp/api/deflist/add"


    Normal  :
        # パラメータ: マイリストID
        LIST: "http://www.nicovideo.jp/api/mylist/list?group_id=%s",

        ADD: "http://www.nicovideo.jp/api/mylist/add",
