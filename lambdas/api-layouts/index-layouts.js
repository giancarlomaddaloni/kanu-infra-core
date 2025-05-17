const AWS = require("aws-sdk");
const { randomUUID } = require('crypto');

const dynamo = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event, context) => {
    let body;
    let statusCode = 200;
    const headers = {
        "Content-Type": "application/json"
    };

    try {
        switch (event.routeKey) {
            case "GET /layouts/{id}":
                body = await getLayoutById(event);
                break;
            case "GET /layouts":
                body = await getAllLayouts();
                break;
            case "PUT /layouts/{id}":
                body = await editLayout(event);
                break;
            case "POST /layouts":
                body = await addLayout(event);
                break;
            case "DELETE /layouts/{id}":
                body = await deleteLayout(event);
                break;
            default:
                throw new Error(`Unsupported route: "${event.routeKey}"`);
        }
    } catch (err) {
        statusCode = 400;
        body = err.message;
    } finally {
        body = JSON.stringify(body);
    }

    return {
        statusCode,
        body,
        headers
    };
};

const editLayout = async (event) => {
    let paramId = event.pathParameters.id;
    let requestJSON = JSON.parse(event.body);
    await dynamo.put({
        TableName: "layouts",
        Item: {
            id: paramId,
            name: requestJSON.name,
            layout: requestJSON.layout
        }
    }).promise();

    const response = {
        "type" : "success",
        "id" : paramId
    };
    
    return response;
};

const addLayout = async (event) => {
    let randomId = randomUUID();
    let requestJSON = JSON.parse(event.body);
    await dynamo.put({
        TableName: "layouts",
        Item: {
            id: randomId,
            name: requestJSON.name,
            layout: requestJSON.layout
        }
    }).promise();
    
    const response = {
        "type" : "success",
        "id" : randomId
    };

    return response;
};

const getAllLayouts = async () => {
    let response = await dynamo.scan({
        TableName: "layouts",
        AttributesToGet: ["id", "name"]
    }).promise();

    let sorted = response.Items.sort((x,y) => x['id'] === "default" ? -1 : y['id'] === "default");
    let newResponse = sorted.map(({ id: value, name: text }) => ({ value, text }));
    return newResponse;
};

const getLayoutById = async (event) => {
    let response = await dynamo.get({
        TableName: "layouts",
        Key: {
            id: event.pathParameters.id
        }
    }).promise();
    
    let newResponse = Object.keys(response).length > 0 ? response.Item.layout : response;
    return newResponse;
};

const deleteLayout = async (event) => {
    await dynamo.delete({
        TableName: "layouts",
        Key: {
            id: event.pathParameters.id
        }
    }).promise();

    return `Deleted layout ${event.pathParameters.id}`;
};
