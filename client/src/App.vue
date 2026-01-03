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
    background-color: #f5f5f5;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}
</style>
