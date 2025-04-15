const { JWT } = require('google-auth-library');
const key = require("../config/pushkey.json");

const FCM_URL = `https://fcm.googleapis.com/v1/projects/${process.env.FIREBASE_PROJECT_ID}/messages:send`;
const SCOPES = ['https://www.googleapis.com/auth/firebase.messaging'];

module.exports = (() => {
    const jwtClient = new JWT({
        email: key.client_email,
        key: key.private_key,
        scopes: SCOPES
    });

    // Function to get access token
    const getAccessToken = async () => {
        try {
            const { access_token } = await jwtClient.authorize();
            return access_token;
        } catch (error) {
            console.error("❌ Error getting access token:", error.message);
            return null;
        }
    };

    // Function to send push notification
    const sendMessage = async (message) => {
        if (!message || !message.message || !message.message.token) {
            return { error: "Invalid message format" };
        }

        console.log(`📤 Sending message to ${message.message.token}`);

        try {
            const response = await jwtClient.request({
                method: 'POST',
                url: FCM_URL,
                data: message
            });
            console.log("✅ FCM Response:", response.data);
            return response.data;
        } catch (error) {
            console.error("❌ FCM Error:", error.response?.data || error.message);
            return { error: error.response?.data || error.message };
        }
    };

    return { getAccessToken, sendMessage };
})();
