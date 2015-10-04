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
    #  GET
    # /:liveId
    GET_PLAYER_STATUS: "http://live.nicovideo.jp/api/getplayerstatus/"

    #  パラメータ: コメントスレッドID
    GET_POSTKEY: "http://live.nicovideo.jp/api/getpostkey?thread=%s"

    #  パラメータ: 放送ID, 動画ID
    # GET
    #   v       : LiveID
    #   id      : Request movie ID (if request)
    #   mode    : "cancel", "requesting", or none
    NSEN_REQUEST: "http://live.nicovideo.jp/api/nsenrequest"

    # GET
    #   v   : LiveID
    NSEN_GOOD: "http://ow.live.nicovideo.jp/api/nsengood"

    # GET
    #   v   : LiveID
    NSEN_SKIP: "http://ow.live.nicovideo.jp/api/nsenskip"


exports.Video =
    #  GET
    #  /:movieId
    GET_VIDEO_INFO: "http://ext.nicovideo.jp/api/getthumbinfo/"

exports.MyList =
    FETCH_TOKEN: "http://www.nicovideo.jp/my/mylist"
    GET_GROUPS: "http://www.nicovideo.jp/api/mylistgroup/list"

    DefList :
        LIST: "http://www.nicovideo.jp/api/deflist/list"

        #  フォームデータ: item_type, item_id, token, ?description
        ADD: "http://www.nicovideo.jp/api/deflist/add"

        # POST
        #   id_list[0][]    : MyList Item ID Array for deletion
        #   token           : MyList control token
        DELETE: "http://www.nicovideo.jp/api/deflist/delete"

        # POST
        #   target_group_id : MyListID to move
        #   id_list[0][]    : MyList Item ID Array
        #   token           : MyList control token
        MOVE: "http://www.nicovideo.jp/api/deflist/move"


    Normal  :
        # パラメータ: マイリストID
        # GET
        #   group_id        : MyListID
        LIST: "http://www.nicovideo.jp/api/mylist/list?group_id=%s",

        # POST
        #   group_id        : MyListID
        #   item_id         : Movie ID
        #   description     : comment
        #   token           : MyList control token
        ADD: "http://www.nicovideo.jp/api/mylist/add",

        # POST
        #   group_id        : MyListID
        #   id_list[0][]    : MyList Item ID Array for deletion
        #   token           : MyList control token
        DELETE: "http://www.nicovideo.jp/api/mylist/delete"

        # POST
        #   group_id        : MyListID from move
        #   target_group_id : MyListID to move
        #   id_list[0][]    : MyList Item ID Array
        #   token           : MyList control token
        MOVE: "http://www.nicovideo.jp/api/deflist/move"

exports.User =
    # GET
    #   user_id     : UserID
    #   __format    : Response format("xml" or "json")
    INFO : "http://api.ce.nicovideo.jp/api/v1/user.info"
