# CRM roadmap

## Later CRM sections

- Add `/crm/analytics` for sales and marketing analytics: revenue potential, conversion by stage, source efficiency, manager workload, lost-deal reasons, next-contact SLA.
- Add user profile editing for every user and employee: avatar, description, contacts, role notes, skills and public display name.
- Extend task chats: each task should have an internal discussion thread with file attachments and mentions.
- Extend project chats: improve the existing project chat area into a real project communication thread with files, mentions and activity history.

## Product notes

- CRM is now available from the sidebar for roles that have CRM access.
- The main CRM board should stay optimized for dense work: compact cards, fast stage moves, search, filters and clear next actions.
- Keep both views useful: board for pipeline work, list for fast search and high-volume processing.
- Pipeline management is available in CRM: admins can create, rename and hide empty pipelines.
- Lead distribution rules are available in CRM: admins can assign source channels manually, by queue, by least loaded manager or to fixed managers.
- Consolidated all-sources overview is available through the "Все сделки" CRM view.
- First external lead intake endpoint is available: `POST /api/crm/leads`.
- First external dialog intake endpoint is available: `POST /api/crm/dialogs`. It finds or creates a CRM deal, attaches the external conversation and saves the incoming message.
- Deal cards now have a client dialog tab with CRM-side replies.
- Avito Messenger webhook endpoint is available: `POST /api/avito/messenger/webhook`.
- CRM replies in Avito conversations are sent back to Avito Messenger API.
- Next priority: add UI for connecting Avito webhook per account and connector presets for Tilda and Telegram lead sources.
