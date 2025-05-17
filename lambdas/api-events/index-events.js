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
            case "GET /events/{id}":
                body = await getEventById(event);
                break;
            case "GET /events":
                body = await getAllEvents();
                break;
            case "PUT /events/{id}":
                body = await editEvent(event);
                break;
            case "POST /events":
                body = await addBatchEvents(event);
                break;
            case "DELETE /events/{id}":
                body = await deleteEvent(event);
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

const editEvent = async (event) => {
    let paramId = event.pathParameters.id;
    let requestJSON = JSON.parse(event.body);
    await dynamo.put({
        TableName: "events",
        Item: {
            id: paramId,
            event: requestJSON
        }
    }).promise();

    const response = {
        "type" : "success",
        "id" : paramId
    };
    
    return response;
};

const addBatchEvents = async (events) => {
    let ids = [];
    let requestJSON = JSON.parse(events.body);
    let currentDate = new Date().toISOString();
    for(const changeListKey in requestJSON) {
        const change = requestJSON[changeListKey];
        for(const eventKey in change.changes){
            const event = change.changes[eventKey]
            let data = {
                EventId: eventKey,
                TeamPlayerRoundId: event.TeamPlayerRoundId,
                TournamentId: event.TournamentId,
                TournamentRoundId: event.TournamentRoundId,
                Values: event.values ? event.values : null,
                Type: event.type
            };
            ids.push(await addEvent(data, currentDate));
        }
    }
    
    const response = {
        "type" : "success",
        "ids" : ids
    };
    
    return response;
};

const addEvent = async (event, currentDate) => {
    let randomId = randomUUID();
    await dynamo.put({
        TableName: "events",
        Item: {
            id: randomId,
            eventId: event.EventId,
            type: event.Type,
            teamPlayerRoundId: event.TeamPlayerRoundId,
            tournamentId: event.TournamentId,
            tournamentRoundId: event.TournamentRoundId,
            values: event.Values ? event.Values : null,
            submittedOn: currentDate
        }
    }).promise();

    return randomId;
};

const getAllEvents = async () => {
    let response = await dynamo.scan({
        TableName: "events"
    }).promise();

    return response;
};

const getEventById = async (event) => {
    let response = await dynamo.get({
        TableName: "events",
        Key: {
            id: event.pathParameters.id
        }
    }).promise();
    
    let newResponse = Object.keys(response).length > 0 ? response.Item.event : response;
    return newResponse;
};

const deleteEvent = async (event) => {
    await dynamo.delete({
        TableName: "events",
        Key: {
            id: event.pathParameters.id
        }
    }).promise();

    return `Deleted event ${event.pathParameters.id}`;
};
