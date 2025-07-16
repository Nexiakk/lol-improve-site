// src/components/common/RuneDisplay.jsx
import React from "react";
import { Popover } from "antd";

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

/**
 * RuneDisplay Component
 * Renders a player's rune page, with options for full or compact layout and size.
 *
 * @param {object} props - The component props.
 * @param {object} props.perks - The perks object from match data (either match.perks or participant.perks).
 * @param {Array} props.runesDataFromDDragon - The full runesReforged.json data from DDragon.
 * @param {object} props.runesMap - A flat map of rune IDs to rune data (icon, name, key).
 * @param {function} props.getRuneImage - Function to get the URL for a rune image.
 * @param {object} [props.popoverProps] - Optional props to pass to the Ant Design Popover component for rune details. If provided, the component will be wrapped in a Popover.
 * @param {string} [props.layout='compact'] - 'full' or 'compact'. Full shows tree headers and 3x3 shards, compact shows no headers and 1x3 shards.
 * @param {string} [props.size='md'] - 'sm' (small), 'md' (medium), 'lg' (large). Affects rune and shard icon sizes.
 * @param {React.ReactNode} [props.children] - The element that will trigger the popover. If not provided and popoverProps are used, a default trigger will be rendered.
 * @param {React.RefObject} [props.playerCardRef] - Optional ref to the parent player card for popover placement.
 */
const RuneDisplay = ({ perks, runesDataFromDDragon, runesMap, getRuneImage, popoverProps, layout = "compact", size = "md", children, playerCardRef }) => {
  const primaryTreeId = perks.styles?.find((s) => s.description === "primaryStyle")?.style || perks.perkStyle;
  const secondaryTreeId = perks.styles?.find((s) => s.description === "subStyle")?.style || perks.perkSubStyle;
  const selectedRuneIds = perks.styles ? perks.styles.flatMap((s) => s.selections.map((sel) => sel.perk)) : perks.perkIds || [];
  const statShards = perks.statPerks ? [perks.statPerks.offense, perks.statPerks.flex, perks.statPerks.defense] : perks.perkIds?.slice(-3) || [];

  const primaryTree = runesDataFromDDragon.find((tree) => tree.id === primaryTreeId);
  const secondaryTree = runesDataFromDDragon.find((tree) => tree.id === secondaryTreeId);

  if (!primaryTree) {
    return <p className="text-gray-400 text-center text-xs">Rune data unavailable.</p>;
  }

  const getSizeClasses = (type, isPrimaryTreeRune = false) => {
    switch (size) {
      case "sm":
        return type === "keystone" ? "w-6 h-6" : type === "rune" ? "w-4 h-4" : type === "header" ? "w-3 h-3" : type === "shard" ? "w-2.5 h-2.5" : "";
      case "md":
        return type === "keystone" ? (isPrimaryTreeRune && layout === "full" ? "w-10 h-10" : "w-8 h-8") : type === "rune" ? (isPrimaryTreeRune && layout === "full" ? "w-6 h-6" : "w-5 h-5") : type === "header" ? "w-3.5 h-3.5" : type === "shard" ? "w-3.5 h-3.5" : "";
      case "lg":
        return type === "keystone" ? (isPrimaryTreeRune && layout === "full" ? "w-12 h-12" : "w-9 h-9") : type === "rune" ? (isPrimaryTreeRune && layout === "full" ? "w-8 h-8" : "w-7 h-7") : type === "header" ? "w-4 h-4" : type === "shard" ? "w-4 h-4" : "";
      default:
        return getSizeClasses("md"); // Fallback to medium
    }
  };

  const renderRuneTree = (tree, selectedPerkIds, isPrimaryTree) => {
    if (!tree) return null;

    const slotsToRender = isPrimaryTree ? tree.slots : tree.slots.slice(1, 4);
    const keystoneImageSize = getSizeClasses("keystone", isPrimaryTree);
    const runeImageSize = getSizeClasses("rune", isPrimaryTree);
    const treeBorderColor = RUNE_TREE_COLORS[tree.id] || "border-gray-500";
    const headerImageSize = getSizeClasses("header");

    const treeSpaceY = isPrimaryTree && layout === "full" ? "space-y-3" : "space-y-2";

    return (
      <div className={`flex flex-col items-center ${treeSpaceY}`}>
        {layout === "full" && (
          <div className="flex justify-center items-center gap-1.5 mb-2 p-0.5 rounded-md">
            {runesDataFromDDragon
              .filter((t) => {
                if (!isPrimaryTree && t.id === primaryTreeId) {
                  return false;
                }
                return true;
              })
              .map((headerTree) => {
                const isSelected = headerTree.id === tree.id;
                const highlightClass = isSelected ? "opacity-100" : "opacity-40 filter grayscale hover:opacity-70 hover:filter-none";
                return (
                  <div key={headerTree.id} className={`transition-opacity duration-200 ${highlightClass}`} title={headerTree.name}>
                    <img src={getRuneImage(headerTree.id)} alt={headerTree.name} className={headerImageSize} />
                  </div>
                );
              })}
          </div>
        )}

        {slotsToRender.map((slot, slotIndex) => {
          const isKeystoneRow = isPrimaryTree && slotIndex === 0;
          const rowLayoutClass = isKeystoneRow ? "flex justify-center items-center w-full" : "flex justify-center items-center w-full";
          const gapClass = isKeystoneRow ? "gap-0" : "gap-1";

          return (
            <div key={`${tree.id}-slot-${slotIndex}`} className={`${rowLayoutClass} ${gapClass}`}>
              {slot.runes.map((rune) => {
                const isActive = selectedPerkIds.includes(rune.id);
                const currentRuneSize = isKeystoneRow ? keystoneImageSize : runeImageSize;
                const activeRuneClasses = isActive ? "opacity-100" : "opacity-100 filter grayscale brightness-60";
                const shouldShowBorder = isActive && !isKeystoneRow;

                return (
                  <div key={rune.id} className={`relative p-0 rounded-full transition-opacity duration-200 ${activeRuneClasses} flex-shrink-0`} title={runesMap[rune.id]?.name || rune.name}>
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

    const shardImageSize = getSizeClasses("shard");
    const activeShardClasses = (isActive) => (isActive ? "border-yellow-400 border opacity-100" : "border-gray-700 border opacity-50 filter grayscale");

    if (layout === "compact") {
      return (
        <div className="flex justify-center gap-1 mt-0.5">
          {statShards.map((shardId, index) => {
            const rowOptions = STAT_SHARD_ROWS[index];
            const selectedShard = rowOptions.find((s) => s.id === shardId);
            if (!selectedShard) return null;

            const shardIconSrc = getStatShardImage(selectedShard.iconName);
            return (
              <div key={shardId} title={selectedShard.name} className={`p-0.5 rounded-full transition-opacity duration-200 ${activeShardClasses(true)} flex-shrink-0`}>
                <img src={shardIconSrc} alt={selectedShard.name} className={`${shardImageSize} rounded-full`} />
              </div>
            );
          })}
        </div>
      );
    }

    const [selectedOffense, selectedFlex, selectedDefense] = statShards;
    return (
      <div className="flex flex-col items-center space-y-1.5 pt-0.5">
        {[
          { options: STAT_SHARD_ROWS[0], selected: selectedOffense },
          { options: STAT_SHARD_ROWS[1], selected: selectedFlex },
          { options: STAT_SHARD_ROWS[2], selected: selectedDefense },
        ].map((row, rowIndex) => (
          <div key={`stat-shard-row-${rowIndex}`} className="flex justify-center gap-2.5 items-center">
            {row.options.map((shard) => {
              const isActive = shard.id === row.selected;
              const shardIconSrc = getStatShardImage(shard.iconName);
              return (
                <div key={shard.id} title={shard.name} className={`p-0.5 rounded-full transition-opacity duration-200 ${activeShardClasses(isActive)} flex-shrink-0`}>
                  <img src={shardIconSrc} alt={shard.name} className={`${shardImageSize} rounded-full`} />
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  const content = (
    <div className={`flex ${layout === "full" ? "items-stretch gap-3" : "items-start gap-3 p-1"} min-w-0 w-full`}>
      <div className={`${layout === "compact" ? "flex-grow" : ""} min-w-0 flex-shrink-0`}>{primaryTree && renderRuneTree(primaryTree, selectedRuneIds, true)}</div>
      <div className={`flex flex-col ${layout === "full" ? "" : "justify-center flex-grow"} min-w-0 flex-shrink-0`}>
        {secondaryTree && renderRuneTree(secondaryTree, selectedRuneIds, false)}
        <hr className={`border-gray-700 ${layout === "full" ? "my-2 w-19/20" : "my-2 w-19/20"} mx-auto`} />
        {renderStatShardsDisplay()}
      </div>
    </div>
  );

  const defaultPopoverTrigger = (
    <div className="flex flex-col space-y-0.5">
      <div className="w-6 h-6 bg-black/20 rounded flex items-center justify-center border border-gray-600/50">{getRuneImage(selectedRuneIds[0]) ? <img src={getRuneImage(selectedRuneIds[0])} alt={runesMap[selectedRuneIds[0]]?.name || "Keystone"} className="w-full h-full object-contain" /> : <div className="w-full h-full rounded-sm bg-gray-700/50 flex items-center justify-center text-xs text-gray-500">K?</div>}</div>
      <div className="w-6 h-6 bg-black/20 rounded flex items-center justify-center border border-gray-600/50 p-0.5">{getRuneImage(secondaryTreeId) ? <img src={getRuneImage(secondaryTreeId)} alt={runesMap[secondaryTreeId]?.name || "Secondary Tree"} className="w-full h-full object-contain" /> : <div className="w-full h-full rounded-sm bg-gray-700/50 flex items-center justify-center text-xs text-gray-500">S?</div>}</div>
    </div>
  );

  if (popoverProps) {
    // Merge the custom getPopupContainer logic with existing popoverProps
    const finalPopoverProps = {
      ...popoverProps,
      getPopupContainer: () => document.body, // Always render to body to prevent layout shifts
      overlayStyle: {
        ...popoverProps.overlayStyle,
        zIndex: 1000,
      },
      overlayInnerStyle: {
        backgroundColor: "#18181b",
        border: "1px solid #3f3f46",
        borderRadius: "8px",
        padding: "12px",
        ...popoverProps.overlayInnerStyle,
      },
    };

    return (
      <Popover content={content} {...finalPopoverProps}>
        {children || defaultPopoverTrigger}
      </Popover>
    );
  }

  return content;
};

export default RuneDisplay;
