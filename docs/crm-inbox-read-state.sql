alter table public.crm_conversations
  add column if not exists last_client_message_at timestamptz,
  add column if not exists last_manager_message_at timestamptz,
  add column if not exists read_at timestamptz;

create index if not exists crm_conversations_inbox_idx
  on public.crm_conversations(workspace_id, updated_at desc);

update public.crm_conversations conversation
set
  last_client_message_at = stats.last_client_message_at,
  last_manager_message_at = stats.last_manager_message_at,
  read_at = coalesce(conversation.read_at, stats.last_manager_message_at)
from (
  select
    conversation_id,
    max(created_at) filter (where sender_type = 'client') as last_client_message_at,
    max(created_at) filter (where sender_type = 'manager') as last_manager_message_at
  from public.crm_messages
  group by conversation_id
) stats
where conversation.id = stats.conversation_id;
