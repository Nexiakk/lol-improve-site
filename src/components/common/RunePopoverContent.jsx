// src/components/RunePopoverContent.jsx
import React from "react";

// Keep the constants related to this component with it
const RUNE_TREE_COLORS = {
  8000: "border-yellow-400", // Precision
  8100: "border-red-500", // Domination
  8200: "border-blue-400", // Sorcery
  8400: "border-green-400", // Resolve
  8300: "border-teal-400", // Inspiration
};

const LOCAL_STAT_SHARD_ICONS = {
  StatModsAdaptiveForceIcon: "/src/assets/shards/StatModsAdaptiveForceIcon.webp",
  StatModsAttackSpeedIcon: "/src/assets/shards/StatModsAttackSpeedIcon.webp",
  StatModsCDRScalingIcon: "/src/assets/shards/StatModsCDRScalingIcon.webp",
  StatModsHealthFlatIcon: "/src/assets/shards/StatModsHealthFlatIcon.webp",
  StatModsMovementSpeedIcon: "/src/assets/shards/StatModsMovementSpeedIcon.webp",
  StatModsTenacityIcon: "/src/assets/shards/StatModsTenacityIcon.webp",
  StatModsHealthPlusIcon: "/src/assets/shards/StatModsHealthPlusIcon.webp",
};

const STAT_SHARD_ROWS = [
  // ... (This is the same STAT_SHARD_ROWS from MatchHistoryPage.jsx)
  [
    { id: 5008, name: "Adaptive Force", iconName: "StatModsAdaptiveForceIcon" },
    { id: 5005, name: "Attack Speed", iconName: "StatModsAttackSpeedIcon" },
    { id: 5007, name: "Ability Haste", iconName: "StatModsCDRScalingIcon" },
  ],
  [
    { id: 5008, name: "Adaptive Force", iconName: "StatModsAdaptiveForceIcon" },
    { id: 5010, name: "Movement Speed", iconName: "StatModsMovementSpeedIcon" },
    { id: 5001, name: "Health Scaling", iconName: "StatModsHealthPlusIcon" },
  ],
  [
    { id: 5011, name: "Base Health", iconName: "StatModsHealthFlatIcon" },
    { id: 5009, name: "Tenacity and Slow Resist", iconName: "StatModsTenacityIcon" },
    { id: 5001, name: "Health Scaling", iconName: "StatModsHealthPlusIcon" },
  ],
];

const getStatShardImage = (iconName) => {
  const localIcon = LOCAL_STAT_SHARD_ICONS[iconName];
  if (localIcon) return localIcon;
  return `https://placehold.co/20x20/1a1a1a/4a4a4a?text=S`;
};

// The component logic and styles, extracted from MatchHistoryPage.jsx
const RunePopoverContent = ({ perks, runesDataFromDDragon, runesMap, getRuneImage }) => {
  // This logic correctly handles both data sources
  const primaryTreeId = perks.styles?.find((s) => s.description === "primaryStyle")?.style || perks.perkStyle;
  const secondaryTreeId = perks.styles?.find((s) => s.description === "subStyle")?.style || perks.perkSubStyle;
  const selectedRuneIds = perks.styles ? perks.styles.flatMap((s) => s.selections.map((sel) => sel.perk)) : perks.perkIds || [];
  const statShards = perks.statPerks ? [perks.statPerks.offense, perks.statPerks.flex, perks.statPerks.defense] : perks.perkIds?.slice(-3) || [];

  const primaryTree = runesDataFromDDragon.find((tree) => tree.id === primaryTreeId);
  const secondaryTree = runesDataFromDDragon.find((tree) => tree.id === secondaryTreeId);

  if (!primaryTree) {
    return <p className="text-gray-400 p-4 text-center">Primary rune style not found.</p>;
  }

  const renderRuneTreeDisplay = (tree, selectedPerkIds) => {
    if (!tree) return null;
    const isPrimaryTree = tree.id === primaryTreeId;
    const slotsToRender = isPrimaryTree ? tree.slots : tree.slots.slice(1, 4);
    const runeImageSize = isPrimaryTree ? "w-7 h-7" : "w-5 h-5";
    const keystoneImageSize = "w-9 h-9";
    const treeBorderColor = RUNE_TREE_COLORS[tree.id] || "border-gray-500";
    const headerTrees = isPrimaryTree ? runesDataFromDDragon : runesDataFromDDragon.filter((t) => t.id !== primaryTreeId);

    // CHANGE 1 & 2: Conditional header image size
    const headerImageSize = isPrimaryTree ? "w-5 h-5" : "w-4 h-4";

    return (
      <div className="flex flex-col items-center space-y-2.5">
        <div className="flex justify-center items-center gap-3 mb-2 p-1 rounded-md">
          {headerTrees.map((headerTree) => {
            const isSelected = headerTree.id === tree.id;
            const highlightClass = isSelected ? "opacity-100 scale-110" : "opacity-40 filter grayscale hover:opacity-70 hover:filter-none";
            return (
              <div key={headerTree.id} className={`transition-all ${highlightClass}`} title={headerTree.name}>
                <img src={getRuneImage(headerTree.id)} alt={headerTree.name} className={headerImageSize} />
              </div>
            );
          })}
        </div>

        {slotsToRender.map((slot, slotIndex) => {
          const isKeystoneRow = isPrimaryTree && slotIndex === 0;
          // CHANGE 3: The keystone row now has a fixed min-width and uses justify-around
          const rowLayoutClass = isKeystoneRow ? "flex justify-center items-center w-full min-w-[170px] space-x-0.5" : "flex justify-center items-center w-full space-x-2";

          return (
            <div key={`${tree.id}-slot-${slotIndex}`} className={rowLayoutClass}>
              {slot.runes.map((rune) => {
                const isActive = selectedPerkIds.includes(rune.id);
                const currentRuneSize = isKeystoneRow ? keystoneImageSize : runeImageSize;
                const activeRuneClasses = isActive ? "opacity-100" : "opacity-100 filter grayscale brightness-60";
                const shouldShowBorder = isActive && !isKeystoneRow;

                return (
                  <div key={rune.id} className={`relative p-0 rounded-full transition-all ${activeRuneClasses}`} title={runesMap[rune.id]?.name || rune.name}>
                    <img src={getRuneImage(rune.id)} alt={runesMap[rune.id]?.name || rune.name} className={`${currentRuneSize} rounded-full`} />
                    {shouldShowBorder && <div className={`absolute -inset-0.5 rounded-full border-2 ${treeBorderColor}`}></div>}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  };

  const renderStatShardsDisplay = () => {
    if (statShards.length < 3) return null;
    const [offense, flex, defense] = statShards;
    return (
      <div className="flex flex-col items-center space-y-1.5 pt-0.5">
        {[
          { options: STAT_SHARD_ROWS[0], selected: offense },
          { options: STAT_SHARD_ROWS[1], selected: flex },
          { options: STAT_SHARD_ROWS[2], selected: defense },
        ].map((row, rowIndex) => (
          <div key={`stat-shard-row-${rowIndex}`} className="flex justify-center space-x-2.5 items-center">
            {row.options.map((shard) => {
              const isActive = shard.id === row.selected;
              const shardIconSrc = getStatShardImage(shard.iconName);
              const activeClasses = isActive ? "border-yellow-400 border-2 opacity-100 scale-110" : "border-gray-700 border opacity-50 filter grayscale";
              return (
                <div key={shard.id} title={shard.name} className={`p-0.5 rounded-full transition-all ${activeClasses}`}>
                  <img src={shardIconSrc} alt={shard.name} className="w-3.5 h-3.5 rounded-full" />
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="flex items-start gap-4">
      <div>{primaryTree && renderRuneTreeDisplay(primaryTree, selectedRuneIds)}</div>
      <div className="flex flex-col">
        {secondaryTree && renderRuneTreeDisplay(secondaryTree, selectedRuneIds)}
        {/* CHANGE 4: The horizontal rule is now narrower */}
        <hr className="border-gray-700 my-2 w-4/5 mx-auto" />
        {renderStatShardsDisplay()}
      </div>
    </div>
  );
};

export default RunePopoverContent;
