# Stringee PCC Call Center Setup

## 1. Environment variables

Set these on Vercel Project Settings > Environment Variables, and in local `.env.local` only when running `vercel dev`.

```env
STRINGEE_API_SID=
STRINGEE_API_SECRET=
STRINGEE_PROJECT_ID=
STRINGEE_FROM_NUMBER=
CALL_FALLBACK_AGENT_ID=
CALL_FALLBACK_AGENT_NAME=
PUBLIC_APP_URL=https://www.metta.edu.vn
REQUIRE_RECORDING_AUTH=false
```

Do not add real SID, API secret, or signing secret to Git.

`STRINGEE_SIGNING_SECRET` is optional for now. Leave it empty unless Stringee provides the exact webhook signature format for PCC callbacks.

## 2. PCC mode

When PCC is active, keep the Stringee Project/Number URLs on their PCC defaults:

```text
Project Answer URL: http://v2.stringee.com:8282/project_answer_url
Project Event URL:  http://v2.stringee.com:8282/project_event_url
Number Answer URL:  http://v2.stringee.com:8282/answer_url
Number Event URL:   http://v2.stringee.com:8282/event_url
```

Do not overwrite those with `/api/call/answer`. PCC routing is controlled by Queue, Group, Agent and the Queue `get_list_agents_url`.

## 3. CRM endpoints

```text
Outbound PCC callout:
POST https://www.metta.edu.vn/api/call/outbound

Inbound Queue agent routing:
https://www.metta.edu.vn/api/call/pcc-agents

General call events / recording:
https://www.metta.edu.vn/api/call/event
```

Open Admin > Settings > Call Center Stringee and copy the Queue `get_list_agents_url` shown there into the PCC Queue.

## 4. PCC setup in Stringee

1. Project `Metta` has PCC enabled.
2. Hotline `842471058267` belongs to the same project.
3. Add Agents with the real Stringee user IDs for each active CRM sales account.
4. Add agents into a Sales group.
5. Create a Queue, enable recording, and assign the Sales group.
6. Set Queue `get_list_agents_url` to the CRM URL from Settings.
7. Make sure agent manual status is `AVAILABLE`.

## 5. CRM mapping

Open Admin > Settings > Call Center Stringee.

Live mapping checklist:

| CRM user | Stringee userId | Routing |
| --- | --- | --- |
| Active sales account | Real Stringee userId | App/SIP or Phone bridge |

For routing to the agent's personal phone, set Routing to `SÄT agent` and fill `SÄT agent` with country code.

## 6. Sales workflow

1. Sales opens Leads CRM.
2. Click the phone button on a lead.
3. CRM calls `/api/call/outbound`.
4. Stringee PCC rings the agent first.
5. When the agent answers, Stringee connects to the parent/customer number.
6. When the call ends, sales selects a disposition and writes a note.
7. CRM saves `callLogs` and appends a `call` activity to the lead timeline.
8. If Stringee sends recording URL, CRM stores it and shows a recording link.

## 7. Test checklist

- Agent token connects with `icc_api: true`.
- Outbound call from lead card rings the mapped agent.
- After agent answers, parent/customer receives call from `STRINGEE_FROM_NUMBER`.
- Wrap-up disposition is shown after call ends.
- Call log appears on the lead card and lead timeline.
- Inbound from a known lead routes to PIC if online.
- Inbound from a known lead routes to fallback if PIC is offline.
- Inbound from an unknown number routes to fallback.
