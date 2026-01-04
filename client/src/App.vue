<script>
export default {
    onLaunch() {
        console.log('SecChat App Launch');
    },
    onShow() {
        console.log('SecChat App Show');
    },
    globalData: {
        userId: '',
        userName: '',
        serverUrl: '',
        encryptionKey: null
    }
}
</script>

<style>
page {
    background-color: #1e1e1e;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

/* Override uni-app modal dialog to match dark theme */
.uni-modal {
    background-color: #2d2d2d !important;
    border-radius: 16px !important;
    min-width: 320px !important;
    width: 85% !important;
    max-width: 400px !important;
}

.uni-modal__hd {
    color: #ffffff !important;
    padding: 24px 24px 12px !important;
    font-size: 18px !important;
}

.uni-modal__bd {
    color: #aaaaaa !important;
    padding: 12px 24px 24px !important;
    font-size: 15px !important;
}

.uni-modal__ft {
    border-top-color: #444444 !important;
}

.uni-modal__btn {
    color: #ffffff !important;
    border-right-color: #444444 !important;
    padding: 16px 0 !important;
    font-size: 16px !important;
}

.uni-modal__btn_default {
    color: #888888 !important;
}

.uni-modal__btn_primary {
    color: #7c4dff !important;
}
</style>
