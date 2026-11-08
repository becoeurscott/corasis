import { MotionPressable } from "@/components/ui/MotionPressable";
import React, { useState } from "react";
import { StyleSheet, View } from "react-native";

import { Banner, Button, toast, Txt } from "@/components/ui";
import { haptic } from "@/lib/haptics";
import { choiceDef, fill, life, optionLabel } from "@/lib/lifeGame";
import { backend, BackendError, LifeGame, LifeVote } from "@/services/backend";
import { useMe, usePartner } from "@/store/hooks";
import { useTheme } from "@/theme/ThemeProvider";
import { radius, spacing } from "@/theme/tokens";

/** Secret pick → wait → reveal, like the answer flow. A second disagreement is settled by a coin flip. */
export function VotePanel({ game, vote }: { game: LifeGame; vote: LifeVote }) {
  const { colors } = useTheme();
  const me = useMe();
  const partner = usePartner();
  const [choice, setChoice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const def = choiceDef(vote.choice);
  const partnerName = partner?.firstName ?? "your partner";
  const myPick = me ? vote.picks[me.id] : undefined;
  const partnerPicked = !!(partner && vote.picks[partner.id]);

  const submit = async () => {
    if (!choice) return;
    setBusy(true);
    try {
      await backend.castLifeVote(vote.id, choice);
      haptic("success");
    } catch (e) {
      toast(
        e instanceof BackendError ? e.message : "Could not save your pick.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  };

  if (vote.status === "decided") {
    return (
      <Banner
        kind="success"
        title={def.title}
        body={`Decided: ${optionLabel(vote.choice, vote.result)}${vote.decidedBy === "coin" ? " (by coin flip)" : " — you both agreed!"}`}
      />
    );
  }

  const prev = vote.previousPicks;
  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ gap: 4 }}>
        <Txt variant="title">{def.title}</Txt>
        <Txt tone="secondary">{fill(game.name, def.prompt)}</Txt>
      </View>
      {prev && me && partner ? (
        <Banner
          kind="warning"
          title="You didn’t agree"
          body={`You picked ${optionLabel(vote.choice, prev[me.id])}, ${partnerName} picked ${optionLabel(vote.choice, prev[partner.id])}. Talk it over and pick again. ${vote.round >= life.coinFlipRound ? "If you still disagree, a coin flip decides." : ""}`}
        />
      ) : null}

      {myPick ? (
        <View style={[styles.waiting, { backgroundColor: colors.surfaceTint }]}>
          <Txt variant="heading">
            Your pick: {optionLabel(vote.choice, myPick)}
          </Txt>
          <Txt tone="secondary">
            {partnerPicked
              ? "Revealing…"
              : `Waiting for ${partnerName}. Their pick stays hidden until you’ve both chosen.`}
          </Txt>
        </View>
      ) : (
        <>
          <View style={styles.grid}>
            {vote.options.map((id) => {
              const opt = def.options.find((o) => o.id === id)!;
              const on = choice === id;
              return (
                <MotionPressable
                  key={id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  onPress={() => {
                    haptic("selection");
                    setChoice(id);
                  }}
                  style={[
                    styles.option,
                    {
                      backgroundColor: on ? colors.primarySoft : colors.surface,
                      borderColor: on ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Txt style={{ fontSize: 28 }}>{opt.emoji}</Txt>
                  <Txt variant="bodyStrong" center numberOfLines={2}>
                    {opt.label}
                  </Txt>
                  {opt.skill ? (
                    <Txt variant="caption" tone="muted">
                      Fits a {opt.skill} child
                    </Txt>
                  ) : null}
                </MotionPressable>
              );
            })}
          </View>
          <Txt variant="caption" tone="muted" center>
            {partnerPicked ? `${partnerName} has picked. ` : ""}Your pick stays
            secret until you’ve both chosen.
          </Txt>
          <Button
            title="Lock in my pick"
            onPress={submit}
            disabled={!choice}
            loading={busy}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  option: {
    flexGrow: 1,
    flexBasis: "45%",
    minHeight: 110,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 2,
  },
  waiting: { padding: spacing.lg, borderRadius: radius.lg, gap: 4 },
});
