import { apiSuccess } from "@/app/lib/api/errors";
import { requireSuperAdminRoute } from "../../admin/_utils";
import { adminLeadsFailure } from "../_utils";

export const dynamic = "force-dynamic";

function startOfTodayIso() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

function sevenDaysAgoIso() {
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
}

function isActiveStatus(status: string | null | undefined) {
  return status === "active" || status === "connected" || status === "ok";
}

const defaultCategories = [
  {
    name: "CRM и автоматизация",
    slug: "crm",
    description: "Чаты про CRM, интеграции, автоматизацию и воронки продаж",
  },
  {
    name: "Маркетинг и реклама",
    slug: "marketing",
    description: "Чаты про digital, рекламу, SMM, таргет и продвижение",
  },
  {
    name: "Бизнес и предприниматели",
    slug: "business",
    description: "Бизнес-чаты, где могут появляться запросы на услуги",
  },
];

export async function GET() {
  try {
    const { serviceSupabase } = await requireSuperAdminRoute();

    const todayIso = startOfTodayIso();
    const weekIso = sevenDaysAgoIso();

    const [
      workspacesResponse,
      readersResponse,
      categoriesResponse,
      sourceChatsResponse,
      projectsResponse,
      projectSourceChatsResponse,
      keywordsResponse,
      stopWordsResponse,
      latestLeadsResponse,
      leadsTodayResponse,
      leadsWeekResponse,
      failedDeliveryResponse,
      recentDeliveryResponse,
    ] = await Promise.all([
      serviceSupabase
        .from("workspaces")
        .select("id,name,slug,created_at")
        .order("created_at", { ascending: false })
        .limit(200),

      serviceSupabase
        .from("rivn_leads_reader_accounts")
        .select(
          "id,label,phone_hint,status,assigned_niche,last_seen_at,last_error,max_chats_limit,created_at"
        )
        .order("created_at", { ascending: false })
        .limit(100),

      serviceSupabase
        .from("rivn_leads_source_chat_categories")
        .select("id,name,slug,description")
        .order("name", { ascending: true }),

      serviceSupabase
        .from("rivn_leads_source_chats")
        .select(
          "id,category_id,reader_account_id,title,telegram_chat_id,username,invite_link,type,access_level,status,member_count,last_checked_at,last_message_at,created_at"
        )
        .order("created_at", { ascending: false })
        .limit(300),

      serviceSupabase
        .from("rivn_leads_projects")
        .select(
          "id,workspace_id,reader_account_id,name,niche,status,destination_chat_id,telegram_bot_added,daily_lead_limit,monthly_lead_limit,created_at"
        )
        .order("created_at", { ascending: false })
        .limit(200),

      serviceSupabase
        .from("rivn_leads_project_source_chats")
        .select("id,project_id,source_chat_id,enabled,created_at")
        .order("created_at", { ascending: false })
        .limit(1000),

      serviceSupabase
        .from("rivn_leads_keywords")
        .select("id,project_id,value,normalized_value,match_type,enabled,created_at")
        .order("created_at", { ascending: false })
        .limit(1000),

      serviceSupabase
        .from("rivn_leads_stop_words")
        .select("id,project_id,value,normalized_value,enabled,created_at")
        .order("created_at", { ascending: false })
        .limit(1000),

      serviceSupabase
        .from("rivn_leads_leads")
        .select("id,project_id,source_chat_id,status,matched_keywords,delivered_at,created_at")
        .order("created_at", { ascending: false })
        .limit(50),

      serviceSupabase
        .from("rivn_leads_leads")
        .select("id", { count: "exact", head: true })
        .gte("created_at", todayIso),

      serviceSupabase
        .from("rivn_leads_leads")
        .select("id", { count: "exact", head: true })
        .gte("created_at", weekIso),

      serviceSupabase
        .from("rivn_leads_delivery_logs")
        .select("id", { count: "exact", head: true })
        .eq("status", "failed")
        .gte("created_at", weekIso),

      serviceSupabase
        .from("rivn_leads_delivery_logs")
        .select("id,project_id,status,error_message,created_at")
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

    const assertNoError = (label: string, response: { error: { message: string } | null }) => {
      if (response.error) {
        throw new Error(`Не удалось загрузить ${label}: ${response.error.message}`);
      }
    };

    assertNoError("кабинеты", workspacesResponse);
    assertNoError("reader-аккаунты", readersResponse);
    assertNoError("категории чатов", categoriesResponse);
    assertNoError("чаты-источники", sourceChatsResponse);
    assertNoError("проекты RIVN Leads", projectsResponse);
    assertNoError("связи проектов и чатов", projectSourceChatsResponse);
    assertNoError("ключевые слова", keywordsResponse);
    assertNoError("стоп-слова", stopWordsResponse);
    assertNoError("последние лиды", latestLeadsResponse);
    assertNoError("лиды за сегодня", leadsTodayResponse);
    assertNoError("лиды за неделю", leadsWeekResponse);
    assertNoError("ошибки доставки", failedDeliveryResponse);
    assertNoError("последние доставки", recentDeliveryResponse);

    let categories = categoriesResponse.data ?? [];

    if (categories.length === 0) {
      const { error: seedError } = await serviceSupabase
        .from("rivn_leads_source_chat_categories")
        .upsert(defaultCategories, { onConflict: "slug" });

      if (seedError) {
        throw new Error(`Не удалось создать базовые категории RIVN Leads: ${seedError.message}`);
      }

      const { data: seededCategories, error: seededCategoriesError } = await serviceSupabase
        .from("rivn_leads_source_chat_categories")
        .select("id,name,slug,description")
        .order("name", { ascending: true });

      if (seededCategoriesError) {
        throw new Error(
          `Базовые категории созданы, но не удалось перечитать список: ${seededCategoriesError.message}`
        );
      }

      categories = seededCategories ?? [];
    }

    const readers = readersResponse.data ?? [];
    const sourceChats = sourceChatsResponse.data ?? [];
    const projects = projectsResponse.data ?? [];

    return apiSuccess({
      summary: {
        readersTotal: readers.length,
        readersActive: readers.filter((reader) => isActiveStatus(reader.status)).length,
        readersNeedAttention: readers.filter(
          (reader) => reader.status === "auth_required" || Boolean(reader.last_error)
        ).length,
        sourceChatsTotal: sourceChats.length,
        sourceChatsActive: sourceChats.filter((chat) => chat.status === "active").length,
        projectsTotal: projects.length,
        projectsActive: projects.filter((project) => isActiveStatus(project.status)).length,
        leadsToday: leadsTodayResponse.count ?? 0,
        leadsWeek: leadsWeekResponse.count ?? 0,
        failedDeliveriesWeek: failedDeliveryResponse.count ?? 0,
      },
      workspaces: workspacesResponse.data ?? [],
      readers,
      categories,
      sourceChats,
      projects,
      projectSourceChats: projectSourceChatsResponse.data ?? [],
      keywords: keywordsResponse.data ?? [],
      stopWords: stopWordsResponse.data ?? [],
      latestLeads: latestLeadsResponse.data ?? [],
      recentDeliveryLogs: recentDeliveryResponse.data ?? [],
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return adminLeadsFailure(error);
  }
}
