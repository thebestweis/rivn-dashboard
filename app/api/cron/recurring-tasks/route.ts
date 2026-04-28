import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/app/lib/supabase/service-role";
import { verifyCronSecret } from "../verify-cron-secret";

export const dynamic = "force-dynamic";

type RecurrenceRule = {
  id: string;
  workspace_id: string;
  project_id: string | null;
  parent_task_id: string | null;
  title: string;
  description: string | null;
  assignee_ids: string[] | null;
  frequency: "daily" | "weekly" | "monthly";
  interval_value: number | null;
  weekdays: number[] | null;
  month_day: number | null;
  starts_at: string;
  ends_at: string | null;
  next_run_at: string;
  deadline_time: string | null;
  created_by: string | null;
};

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function withDeadlineTime(date: Date, time: string | null) {
  const next = new Date(date);
  const [hours, minutes] = (time || "12:00").split(":").map(Number);
  next.setHours(Number.isFinite(hours) ? hours : 12);
  next.setMinutes(Number.isFinite(minutes) ? minutes : 0);
  next.setSeconds(0);
  next.setMilliseconds(0);
  return next;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonthsSafe(date: Date, months: number, monthDay: number | null) {
  const next = new Date(date);
  const targetDay = monthDay ?? next.getDate();
  next.setMonth(next.getMonth() + months, 1);
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(targetDay, lastDay));
  return next;
}

function getNextRunAt(rule: RecurrenceRule, fromDate: Date) {
  const interval = Math.max(1, Number(rule.interval_value ?? 1));

  if (rule.frequency === "daily") {
    return addDays(fromDate, interval);
  }

  if (rule.frequency === "monthly") {
    return addMonthsSafe(fromDate, interval, rule.month_day);
  }

  const weekdays = (rule.weekdays ?? []).filter(
    (item) => Number.isInteger(item) && item >= 0 && item <= 6
  );
  const allowedWeekdays = weekdays.length > 0 ? weekdays : [fromDate.getDay()];
  let cursor = addDays(fromDate, 1);

  for (let offset = 0; offset < 370; offset += 1) {
    if (allowedWeekdays.includes(cursor.getDay())) {
      return cursor;
    }

    cursor = addDays(cursor, 1);
  }

  return addDays(fromDate, 7 * interval);
}

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const now = new Date();

  const { data: rules, error: rulesError } = await supabase
    .from("task_recurrence_rules")
    .select("*")
    .eq("is_active", true)
    .lte("next_run_at", now.toISOString())
    .limit(100);

  if (rulesError) {
    return NextResponse.json(
      { ok: false, error: rulesError.message },
      { status: 500 }
    );
  }

  let created = 0;
  let skipped = 0;
  const errors: Array<{ ruleId: string; error: string }> = [];

  for (const rule of (rules ?? []) as RecurrenceRule[]) {
    try {
      const runAt = new Date(rule.next_run_at);

      if (rule.ends_at && runAt.getTime() > new Date(rule.ends_at).getTime()) {
        await supabase
          .from("task_recurrence_rules")
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq("id", rule.id)
          .eq("workspace_id", rule.workspace_id);
        skipped += 1;
        continue;
      }

      const occurrenceDate = dateOnly(runAt);
      const deadlineAt = withDeadlineTime(runAt, rule.deadline_time).toISOString();

      const { data: existing } = await supabase
        .from("tasks")
        .select("id")
        .eq("workspace_id", rule.workspace_id)
        .eq("recurrence_rule_id", rule.id)
        .eq("recurrence_occurrence_date", occurrenceDate)
        .maybeSingle();

      if (!existing) {
        const { data: task, error: taskError } = await supabase
          .from("tasks")
          .insert({
            user_id: rule.created_by,
            workspace_id: rule.workspace_id,
            project_id: rule.project_id,
            parent_task_id: rule.parent_task_id,
            title: rule.title,
            description: rule.description,
            deadline_at: deadlineAt,
            position: Date.now(),
            recurrence_rule_id: rule.id,
            recurrence_occurrence_date: occurrenceDate,
          })
          .select("id")
          .single();

        if (taskError || !task) {
          throw new Error(taskError?.message ?? "Task was not created");
        }

        const assigneeIds = (rule.assignee_ids ?? []).filter(Boolean);

        if (assigneeIds.length > 0) {
          const { error: assigneeError } = await supabase
            .from("task_assignees")
            .insert(
              assigneeIds.map((memberId) => ({
                task_id: task.id,
                workspace_member_id: memberId,
              }))
            );

          if (assigneeError) {
            throw new Error(assigneeError.message);
          }
        }

        created += 1;
      } else {
        skipped += 1;
      }

      const nextRunAt = getNextRunAt(rule, runAt);
      await supabase
        .from("task_recurrence_rules")
        .update({
          last_run_at: runAt.toISOString(),
          next_run_at: nextRunAt.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", rule.id)
        .eq("workspace_id", rule.workspace_id);
    } catch (error) {
      errors.push({
        ruleId: rule.id,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({
    ok: errors.length === 0,
    created,
    skipped,
    errors,
  });
}
