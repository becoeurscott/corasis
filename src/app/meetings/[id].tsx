import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { Banner, Button, Card, EmptyState, Header, Screen, toast, Txt, useConfirm } from '@/components/ui';
import { daysUntil, nextOccurrence } from '@/lib/events';
import { formatDate, todayKey } from '@/lib/time';
import { backend, useData } from '@/services/backend';
import { useCouple, useEvents } from '@/store/hooks';
import { spacing } from '@/theme/tokens';

export default function EventDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const couple = useCouple();
  const ev = useEvents().find((e) => e.id === id);
  const profiles = useData((s) => s.profiles);
  const ask = useConfirm((s) => s.ask);
  if (!ev || !couple) {
    return (
      <Screen>
        <Header title="Event" />
        <EmptyState emoji="📅" title="Event not found" />
      </Screen>
    );
  }
  const today = todayKey(couple.coupleTimezone);
  const occ = nextOccurrence(ev, today);
  const days = daysUntil(ev, today);
  const isPast = !ev.recurringAnnual && ev.date < today;

  const cancel = async () => {
    const ok = await ask({ title: ev.cancelled ? 'Restore this event?' : 'Cancel this event?', body: ev.cancelled ? 'It will show again in the calendar and countdowns.' : 'It stays in the list as cancelled; you can restore it later.', confirmTitle: ev.cancelled ? 'Restore' : 'Cancel event', destructive: !ev.cancelled });
    if (!ok) return;
    await backend.upsertEvent({ ...ev, cancelled: !ev.cancelled });
    toast(ev.cancelled ? 'Restored' : 'Cancelled');
  };
  const remove = async () => {
    const ok = await ask({ title: 'Delete this event?', body: 'Removes it for both of you. This cannot be undone.', confirmTitle: 'Delete', destructive: true });
    if (!ok) return;
    await backend.deleteEvent(ev.id);
    router.back();
  };

  return (
    <Screen>
      <Header title={ev.title} />
      <View style={{ gap: spacing.lg }}>
        {ev.cancelled ? <Banner kind="warning" title="Cancelled" body="This event is cancelled and not counted." actionTitle="Restore" onAction={cancel} /> : null}
        <Card tint style={{ alignItems: 'center', gap: 4 }}>
          {isPast ? (
            <Txt variant="title">{formatDate(ev.date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</Txt>
          ) : (
            <>
              <Txt variant="display">{days === 0 ? 'Today' : days}</Txt>
              <Txt tone="secondary">{days === 0 ? '' : days === 1 ? 'day to go' : 'days to go'}</Txt>
              <Txt variant="caption" tone="muted">
                {formatDate(occ, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}{ev.time ? ` at ${ev.time}` : ''} · {ev.timezone.replace(/_/g, ' ')}
              </Txt>
            </>
          )}
        </Card>
        <Card style={{ gap: spacing.sm }}>
          {ev.destination ? <Row label="Where" value={ev.destination} /> : null}
          <Row label="Type" value={ev.kind + (ev.recurringAnnual ? ' · every year' : '')} />
          <Row label="Reminders" value={ev.reminders.length ? ev.reminders.map((d) => (d === 0 ? 'on the day' : `${d} d before`)).join(', ') : 'None'} />
          <Row label="Added by" value={profiles[ev.createdBy]?.firstName ?? '—'} />
          {ev.notes ? <Row label="Notes" value={ev.notes} /> : null}
        </Card>
        {isPast && (ev.kind === 'meeting' || ev.kind === 'visit') ? <Banner kind="info" title="This visit has passed" body="Save a memory from it, or plan the next one." actionTitle="Add a memory" onAction={() => router.push('/memories/new')} /> : null}
        <Button title="Edit" variant="secondary" onPress={() => router.push(`/meetings/edit?id=${ev.id}`)} />
        {isPast && ev.kind === 'meeting' ? <Button title="Plan the next visit" onPress={() => router.push('/meetings/edit?kind=meeting')} /> : null}
        {!ev.cancelled ? <Button title="Cancel event" variant="ghost" onPress={cancel} /> : null}
        <Button title="Delete" variant="danger" onPress={remove} />
      </View>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Txt variant="caption" tone="muted">
        {label}
      </Txt>
      <Txt>{value}</Txt>
    </View>
  );
}
