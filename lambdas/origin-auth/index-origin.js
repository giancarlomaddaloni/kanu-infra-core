const AWS = require("aws-sdk");
const ssm = new AWS.SSM();

exports.handler = async (event, context, callback) => {
    try {
        const request = event.Records[0].cf.request;
        const headers = request.headers;

        const resGetParameter = await ssm.getParameter({
            Name: headers.CLOUDFRONT_ADMIN_PASSWORD_SSM_PARAM_NAME
        }).promise();
        // Specify the username and password to be used
        const user = 'admin';
        const pw = resGetParameter.Parameter.Value;

        // Build a Basic Authentication string
        const authString = 'Basic ' + Buffer.from(user + ':' + pw).toString('base64');

        // Challenge for auth if auth credentials are absent or incorrect
        if (typeof headers.authorization != 'undefined'
            && headers.authorization.length > 0
            && headers.authorization[0].value === authString) {
            // User has authenticated
            callback(null, request);
        } else {
            const response = {
                status: '401',
                statusDescription: 'Unauthorized',
                body: 'Unauthorized',
                headers: {
                    'www-authenticate': [{ key: 'WWW-Authenticate', value: 'Basic' }]
                },
            };
            callback(null, response);
        }
    } catch (error) {
        console.error(error);
    }
};
