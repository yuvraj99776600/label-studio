---
title: Set up webhooks in MLTL Annotate
short: Webhooks
type: guide
tier: all
order: 407
order_enterprise: 407
meta_title: Configure Webhooks in MLTL Annotate
meta_description: MLTL Annotate documentation for setting up and configuring webhooks to integrate MLTL Annotate with your machine learning pipeline.
section: "Integrate & Extend"

---

Webhooks in MLTL Annotate let you set up integrations that subscribe to certain events that occur inside MLTL Annotate. When an event is triggered, MLTL Annotate sends an HTTP POST request to the configured webhook URL. For example:
```json
{
    "action": "TASK_CREATED",
    "tasks": [
        {"id": 1, ...},
        ...
    ]
}
```

Your application or service can then respond to that event information however you want. 

## What to use MLTL Annotate webhooks for 

Some events that happen in MLTL Annotate happen in response to an API call. For those, the API response is sufficient to know that the action has occurred. But other events happen inside the MLTL Annotate UI, such as project changes and task annotation activities. To find out immediately when those changes occur, you can use webhooks to notify your application or machine learning pipeline to take specific actions. 

The actions your webhook takes in your application or pipeline can vary depending on the event. For example, you might use events sent to your webhook URL to do the following:
- Start training a machine learning model after a certain number of tasks have been annotated.
- Perform active learning after a task has been annotated.
- Prompt annotators to begin working on a project after it is fully set up.
- Create a new version of training data in a dataset versioning repository. 

Limit the number of requests to your server by subscribing only to the events relevant for your use case.

## Available MLTL Annotate webhooks
MLTL Annotate makes two main types of events available to integrate with webhooks: project-level task events and organization events.

<table>
<thead>
  <tr>
    <th>Event Action</th>
    <th>Details</th>
    <th>Use Case</th>
  </tr>
  </thead>
  <tr>
    <td><a href="webhook_reference.html#Task-Created">Task Created</a></td>
    <td>For a specific project, triggers when new tasks are created. One event per import action. Bulk task creation is sent as one event.</td>
    <td>Use to take action in your machine learning pipeline. </td>
  </tr>
  <tr>
    <td><a href="webhook_reference.html#Task-Deleted">Task Deleted</a></td>
    <td>For a specific project, triggers when tasks are deleted. One event per deletion action. Bulk task deletion is sent as one event.</td>
    <td>Use to update a training dataset version. </td>
  </tr>
  <tr>
    <td><a href="webhook_reference.html#Annotation-Created">Annotation Created</a></td>
    <td>For a specific project, triggers when new annotations are created for any tasks. One event per annotation.</td>
    <td>Use to start training in an active learning scenario.</td>
  </tr>
  <tr>
    <td><a href="webhook_reference.html#Annotation-Updated">Annotation Updated</a></td>
    <td>For a specific project, triggers when an existing annotation is updated, overwritten, or when a task is skipped.</td>
    <td>Use to prompt model retraining. </td>
  </tr>
  <tr>
    <td><a href="webhook_reference.html#Annotation-Deleted">Annotation Deleted</a></td>
    <td>For a specific project, triggers when an annotation is deleted. Bulk annotation deletion is sent as one event.</td>
    <td>Use to create a new version of a training dataset. </td>
  </tr>
  <tr>
    <td><a href="webhook_reference.html#Project-Created">Project Created</a></td>
    <td>For an organization, triggers when a project is created. You must <a href="webhooks.html#Enable-organization-level-webhooks">enable organization-level webhooks</a> to send this event.</td>
    <td>Use to create a new pipeline for data management.</td>
  </tr>
  <tr>
    <td><a href="webhook_reference.html#Project-Updated">Project Updated</a></td>
    <td>Triggers when project settings, such as the labeling configuration, are updated, created, or saved.</td>
    <td>Use to update an existing data management pipeline.</td>
  </tr>
  <tr>
    <td><a href="webhook_reference.html#Project-Deleted">Project Deleted</a></td>
    <td>For an organization, triggers when a project is deleted. You must <a href="webhooks.html#Enable-organization-level-webhooks">enable organization-level webhooks</a> to send this event.</td>
    <td>Use to remove a data management pipeline. </td>
  </tr>
</table>

### Enable organization-level webhooks

To use the organization-level webhooks that trigger events for each project, you must [set an environment variable](https://docs.mltl.us/guide/start#Set-environment-variables).
```shell
LABEL_STUDIO_ALLOW_ORGANIZATION_WEBHOOKS=true
```

## How to integrate with webhooks

To integrate with webhooks in MLTL Annotate, you must do the following:
1. Create a webhook endpoint or URL as part of your application or machine learning model pipeline.
2. Make sure the webhook endpoint or URL is accessible to your MLTL Annotate instance and can accept HTTP POST requests.
3. [Add the webhook to MLTL Annotate](webhooks.html#Add-a-new-webhook-in-Label-Studio).

Set up your webhook endpoint to read the event payload from MLTL Annotate and take action based on the event.

## Add a new webhook in MLTL Annotate

Set up a webhook URL in MLTL Annotate and associate it with one or more event triggers. You can set up a webhook URL in the MLTL Annotate UI, or using the API. You can configure as many webhook connections as you want, but too many might overwhelm your instance. 

### Add a webhook in MLTL Annotate UI

Add a webhook URL to MLTL Annotate. The webhook URL must be set up to accept HTTP POST requests.

1. In the MLTL Annotate UI, open the project that you want to associate with a webhook URL.
2. Click **Settings** and click **Webhooks**.
3. Click **Add Webhook**. 
4. In the **Payload URL** field, provide the URL to send event payloads to. For example, `https://www.example.com/webhook`.
5. (Optional) Toggle the **Is Active** option to deactivate the webhook until it is ready to use. Otherwise, the webhook becomes active as soon as you save it and events are sent to the URL. 
6. (Optional) Click the + sign to add any headers required by the webhook URL. Specify the header name and the value. You can use headers to authenticate a request to your webhook URL. For example, `Authorization` and `Basic bGFiZWxzdHVkaW86ZXhhbXBsZQ==`
7. (Optional) Select whether to send a payload with the event. By default, payloads are sent. If you don't send a payload, only the `action` key is sent. For example, choose to send the payload for `Annotation created` events to update the correct pipeline based on the project ID sent in the payload.  
8. (Optional) Select whether to send an event for all actions in MLTL Annotate supported by webhooks, or specific events. By default, events are sent for all actions. For example, select the `Annotation created` event. 
9. Save the webhook.

### Add a webhook using the MLTL Annotate API

Make a POST request to the [Create a webhook](/api#tag/Webhooks/) endpoint to add a webhook using the API. If you want to extend webhooks with custom events, see [Create a custom webhook event](webhook_create.html). 

## Troubleshoot a webhook connection

Webhook connections time out after 1 second. You can adjust the timeout by setting an environment variable, `WEBHOOK_TIMEOUT`. 

If the webhook URL is inaccessible by MLTL Annotate, you can see this in a traceback in the logs. 

MLTL Annotate does not retry webhook connections that fail. You can see successful webhook deliveries in the logs in DEBUG mode. 




