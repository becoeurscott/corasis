import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';

import { DateField } from '@/components/DateField';
import { TimeField } from '@/components/TimeField';
import { TimezonePicker } from '@/components/TimezonePicker';
import { Banner, Button, Chip, Header, Input, ListItem, Screen, toast, Txt } from '@/components/ui';
import { backend, EventKind } from '@/services/backend';
import { useCouple, useEvents } from '@/store/hooks';
import { spacing } from '@/theme/tokens';

const kinds: { v: EventKind; l: string }[] = [
  { v: 'meeting', l: '✈️ Meeting' },
  { v: 'visit', l: '🧳 Trip' },
  { v: 'anniversary', l: '💍 Anniversary' },
  { v: 'birthday', l: '🎂 Birthday' },
  { v: 'custom', l: '📌 Other' },
];
const reminderOptions = [0, 1, 3, 7, 30];

export default function EditEvent() {
  const couple = useCouple();
  const params = useLocalSearchParams<{ id?: string; kind?: EventKind }>();
  const existing = useEvents().find((e) => e.id === params.id);
  const [kind, setKind] = useState<EventKind>(existing?.kind ?? params.kind ?? 'meeting');
  const [title, setTitle] = useState(existing?.title ?? (params.kind === 'meeting' ? 'Next visit' : ''));
  const [date, setDate] = useState<string | null>(existing?.date ?? null);
  const [allDay, setAllDay] = useState(existing?.allDay ?? true);
  const [time, setTime] = useState(existing?.time ?? '12:00');
  const [tz, setTz] = useState(existing?.timezone ?? couple?.coupleTimezone ?? 'UTC');
  const [dest, setDest] = useState(existing?.destination ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [recurring, setRecurring] = useState(existing?.recurringAnnual ?? (kind === 'anniversary' || kind === 'birthday'));
  const [reminders, setReminders] = useState<number[]>(existing?.reminders ?? [7, 1]);
  const [error, setError] = useState<string | null>(null);

  if (!couple) {
    return (
      <Screen>
        <Header title="Event" />
        <Banner kind="info" body="Connect with your partner to use the shared calendar." />
      </Screen>
    );
  }

  const save = async () => {
    if (!title.trim()) return setError('Give it a title.');
    if (!date) return setError('Pick a date.');
    if (kind === 'meeting' && !recurring && date < new Date().toISOString().slice(0, 10)) return setError('A meeting date cannot be in the past. Use "Trip" for past visits.');
    try {
      await backend.upsertEvent({ id: existing?.id, kind, title: title.trim(), date, allDay, time: allDay ? null : time, timezone: tz, destination: dest.trim() || null, notes: notes.trim() || null, recurringAnnual: recurring, reminders, cancelled: existing?.cancelled ?? false });
      toast(existing ? 'Event updated' : 'Event added', 'success');
      router.back();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <Screen footer={<Button title={existing ? 'Save changes' : 'Add to calendar'} size="lg" onPress={save} />}>
      <Header title={existing ? 'Edit event' : 'New event'} />
      <View style={{ gap: spacing.lg }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {kinds.map((k) => (
            <Chip key={k.v} label={k.l} selected={kind === k.v} onPress={() => { setKind(k.v); if (k.v === 'anniversary' || k.v === 'birthday') setRecurring(true); }} small />
          ))}
        </View>
        {error ? <Banner kind="danger" body={error} /> : null}
        <Input label="Title" value={title} onChangeText={(v) => { setTitle(v); setError(null); }} placeholder={kind === 'birthday' ? "e.g. Alex's birthday" : 'e.g. Next visit'} />
        <DateField label="Date" value={date} onChange={(v) => { setDate(v); setError(null); }} />
        <ListItem title="All day" toggle={allDay} onToggle={setAllDay} />
        {!allDay ? <TimeField label="Time" value={time} onChange={setTime} /> : null}
        <TimezonePicker label="Event time zone" value={tz} onChange={setTz} hint="Countdowns use this zone so the day flips at the right moment for the place you meet." />
        {kind === 'meeting' || kind === 'visit' ? <Input label="Destination" value={dest} onChangeText={setDest} placeholder="City or place" /> : null}
        <Input label="Notes (optional)" value={notes} onChangeText={setNotes} multiline placeholder="Flight numbers, plans, anything" />
        <ListItem title="Repeats every year" toggle={recurring} onToggle={setRecurring} />
        <View style={{ gap: spacing.sm }}>
          <Txt variant="caption" tone="secondary" weight="600">
            Shared reminders (days before)
          </Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {reminderOptions.map((d) => (
              <Chip key={d} label={d === 0 ? 'On the day' : `${d} d`} selected={reminders.includes(d)} onPress={() => setReminders(reminders.includes(d) ? reminders.filter((x) => x !== d) : [...reminders, d].sort((a, b) => b - a))} small />
            ))}
          </View>
          <Txt variant="caption" tone="muted">
            Reminders respect each person's notification settings and quiet hours.
          </Txt>
        </View>
      </View>
    </Screen>
  );
}
