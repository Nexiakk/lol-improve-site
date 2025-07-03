// src/components/ExpandedMatchDetails.jsx
import React, { useState, useEffect, useMemo } from "react";
import { ImageOff, ChevronRight, X, LayoutList, PieChart, Loader2 } from "lucide-react";
import { formatGameDurationMMSS, getKDAColorClass, getKDAStringSpans } from "../utils/matchCalculations";

// --- LOCAL STAT SHARD ICON IMPORTS ---
import statModsAdaptiveForceIcon from "../assets/shards/StatModsAdaptiveForceIcon.webp";
import statModsAttackSpeedIcon from "../assets/shards/StatModsAttackSpeedIcon.webp";
import statModsCDRScalingIcon from "../assets/shards/StatModsCDRScalingIcon.webp";
import statModsHealthFlatIcon from "../assets/shards/StatModsHealthFlatIcon.webp";
import statModsMovementSpeedIcon from "../assets/shards/StatModsMovementSpeedIcon.webp";
import statModsTenacityIcon from "../assets/shards/StatModsTenacityIcon.webp";
import statModsHealthPlusIcon from "../assets/shards/StatModsHealthPlusIcon.webp";

// --- RANK ICON IMPORTS ---
import IRON_SMALL from "../assets/ranks/IRON_SMALL.webp";
import BRONZE_SMALL from "../assets/ranks/BRONZE_SMALL.webp";
import SILVER_SMALL from "../assets/ranks/SILVER_SMALL.webp";
import GOLD_SMALL from "../assets/ranks/GOLD_SMALL.webp";
import PLATINUM_SMALL from "../assets/ranks/PLATINUM_SMALL.webp";
import EMERALD_SMALL from "../assets/ranks/EMERALD_SMALL.webp";
import DIAMOND_SMALL from "../assets/ranks/DIAMOND_SMALL.webp";
import MASTER_SMALL from "../assets/ranks/MASTER_SMALL.webp";
import GRANDMASTER_SMALL from "../assets/ranks/GRANDMASTER_SMALL.webp";
import CHALLENGER_SMALL from "../assets/ranks/CHALLENGER_SMALL.webp";

const rankIconMap = {
  IRON: IRON_SMALL,
  BRONZE: BRONZE_SMALL,
  SILVER: SILVER_SMALL,
  GOLD: GOLD_SMALL,
  PLATINUM: PLATINUM_SMALL,
  EMERALD: EMERALD_SMALL,
  DIAMOND: DIAMOND_SMALL,
  MASTER: MASTER_SMALL,
  GRANDMASTER: GRANDMASTER_SMALL,
  CHALLENGER: CHALLENGER_SMALL,
};

// --- OBJECTIVE ICONS ---
const GrubIcon = ({ className = "" }) => (
  <svg viewBox="0 0 32 32" className={`inline-block text-purple-500 ${className}`} xmlns="http://www.w3.org/2000/svg">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M24 7.26397C27 7.26397 27 10.264 27 11.264C27 14.264 24 15.264 24 15.264H27C26.0189 15.918 25.3587 17.1069 24.6345 18.4107C23.1444 21.0938 21.3837 24.264 16 24.264C10.6163 24.264 8.85561 21.0938 7.36548 18.4107C6.64135 17.1069 5.9811 15.918 5 15.264H8C8 15.264 5 14.264 5 11.264C5 10.264 5 7.26397 8 7.26397H9.58357C10.5151 7.26397 11.4337 7.0471 12.2669 6.63052L15.1056 5.21115C15.6686 4.92962 16.3314 4.92962 16.8944 5.21115L19.7331 6.63051C20.5663 7.0471 21.4849 7.26397 22.4164 7.26397H24ZM19.5354 12.264L15.9999 8.72845L12.4644 12.264L13.7322 13.5319L10.4646 16.7995L14.0001 20.335L15.9993 18.3359L17.9984 20.335L21.5339 16.7995L18.2669 13.5325L19.5354 12.264Z"
      fill="currentColor"
    ></path>
  </svg>
);
const DragonIcon = ({ className = "" }) => (
  <svg viewBox="0 0 32 32" className={`inline-block text-yellow-400 ${className}`} xmlns="http://www.w3.org/2000/svg">
    <path fillRule="evenodd" clipRule="evenodd" d="M23 5.5V11.5H28L23 16.5V20.5L18 24.5L17 27.5H15L14 24.5L9 20.5V16.5L4 11.5H9V5.5L13.5 10L16 4.5L18.4965 10L23 5.5ZM17 17.5L22 14.5L19 20.5L17 19.5V17.5ZM10 14.5L15 17.5V19.5L13 20.5L10 14.5Z" fill="currentColor"></path>
  </svg>
);
const BaronIcon = ({ className = "" }) => (
  <svg viewBox="0 0 32 32" className={`inline-block text-purple-400 ${className}`} xmlns="http://www.w3.org/2000/svg">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M18.2557 5.31855L26.3761 9.8299C26.7612 10.0438 27 10.4497 27 10.8902C27 11.0785 26.9562 11.2642 26.872 11.4326L24.5883 16C24.0923 21.0584 20.4607 25.5315 19.333 26.8109C19.1841 26.9799 18.9147 26.9207 18.8435 26.7069L18 24.1765H14L13.1565 26.7069C13.0853 26.9207 12.8159 26.9799 12.667 26.8109C11.5393 25.5315 7.90768 21.0584 7.41174 16L5.12805 11.4326C5.04384 11.2642 5 11.0785 5 10.8902C5 10.4497 5.23881 10.0438 5.62386 9.8299L13.7443 5.31855C13.8276 5.27226 13.9223 5.35774 13.8848 5.44536L11 12.1765C11.8333 13.0098 14 13.7765 16 10.1765C18 13.7765 20.1667 13.0098 21 12.1765L18.1152 5.44536C18.0777 5.35774 18.1724 5.27226 18.2557 5.31855ZM16 17.1765C16.8284 17.1765 17.5 16.5049 17.5 15.6765C17.5 14.8481 16.8284 14.1765 16 14.1765C15.1716 14.1765 14.5 14.8481 14.5 15.6765C14.5 16.5049 15.1716 17.1765 16 17.1765ZM16 22.1765C16.8284 22.1765 17.5 21.5049 17.5 20.6765C17.5 19.8481 16.8284 19.1765 16 19.1765C15.1716 19.1765 14.5 19.8481 14.5 20.6765C14.5 21.5049 15.1716 22.1765 16 22.1765ZM20.25 18.1765C20.25 19.0049 19.5784 19.6765 18.75 19.6765C17.9216 19.6765 17.25 19.0049 17.25 18.1765C17.25 17.3481 17.9216 16.6765 18.75 16.6765C19.5784 16.6765 20.25 17.3481 20.25 18.1765ZM13.25 19.6765C14.0784 19.6765 14.75 19.0049 14.75 18.1765C14.75 17.3481 14.0784 16.6765 13.25 16.6765C12.4216 16.6765 11.75 17.3481 11.75 18.1765C11.75 19.0049 12.4216 19.6765 13.25 19.6765Z"
      fill="currentColor"
    ></path>
  </svg>
);
const HeraldIcon = ({ className = "" }) => (
  <svg viewBox="0 0 32 32" className={`inline-block text-purple-300 ${className}`} xmlns="http://www.w3.org/2000/svg">
    <path d="M15.9997 19.339C16.7132 19.339 17.2917 17.9477 17.2917 16.7586C17.2917 15.5694 16.7132 15.0327 15.9997 15.0327C15.2862 15.0327 14.7079 15.5694 14.7079 16.7586C14.7079 17.9477 15.2862 19.339 15.9997 19.339Z" fill="currentColor"></path>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M11.6803 11.0327H12.3511C13.4192 10.3975 14.667 10.0327 15.9999 10.0327C17.3329 10.0327 18.5806 10.3975 19.6488 11.0327H20.3195C20.3195 9.03271 20.3195 8.03553 18.9999 6.03271C21.3332 6.53271 25.9999 9.43271 25.9999 17.0327C24.3362 17.6982 23.0184 19.4492 22.3345 20.4989C21.1392 22.777 18.751 24.3309 15.9999 24.3309C13.2488 24.3309 10.8606 22.777 9.66527 20.4989C8.98137 19.4492 7.66364 17.6982 5.9999 17.0327C5.9999 9.43271 10.6666 6.53271 12.9999 6.03271C11.6803 8.03553 11.6803 9.03271 11.6803 11.0327ZM19.7496 16.3329C19.7496 19.1532 18.0709 21.0327 16 21.0327C13.9291 21.0327 12.2502 19.1532 12.2502 16.3329C12.2502 14.262 13.9967 13.5333 16 13.5333C18.0034 13.5333 19.7496 14.262 19.7496 16.3329Z"
      fill="currentColor"
    ></path>
    <path d="M22.1668 25.0509C22.3553 24.4995 22.678 24.0152 23.0006 23.5309C23.4138 22.9108 23.8269 22.2909 23.9576 21.5307C24.0044 21.2585 24.2404 21.0099 24.4829 21.142C24.6688 21.2433 24.7837 21.4011 24.8964 21.556C25.0726 21.798 25.2434 22.0327 25.6711 22.0327C26.6434 22.0327 27 22.0327 27 23.0332C27 23.9184 25.4367 25.585 22.997 25.9576C22.451 26.041 21.9881 25.5736 22.1668 25.0509Z" fill="currentColor"></path>
    <path d="M8.99936 23.5309C9.322 24.0152 9.64473 24.4995 9.83321 25.0509C10.0119 25.5736 9.549 26.041 9.00297 25.9576C6.56334 25.585 5 23.9184 5 23.0332C5 22.0327 5.35661 22.0327 6.32887 22.0327C6.75662 22.0327 6.92743 21.798 7.10356 21.556C7.21629 21.4011 7.33121 21.2433 7.51707 21.142C7.75959 21.0099 7.99559 21.2585 8.0424 21.5307C8.17314 22.2909 8.58618 22.9108 8.99936 23.5309Z" fill="currentColor"></path>
  </svg>
);
const ElderDragonIcon = ({ className = "" }) => (
  <svg viewBox="0 0 32 32" className={`inline-block text-yellow-200 ${className}`} xmlns="http://www.w3.org/2000/svg">
    <path d="M18.25 9.375C17.75 7.625 16 5.125 16 5.125C16 5.125 14.25 7.625 13.75 9.375C14.25 11.125 16 13.625 16 13.625C16 13.625 17.75 11.125 18.25 9.375Z" fill="currentColor"></path>
    <path d="M9.75004 10.125C8.25004 11.125 6.75004 13.875 8.75004 15.625C9.14284 13.4646 9.68995 12.7854 10.3913 11.9146C10.5828 11.677 10.7856 11.4251 11 11.125L13.25 12.625C13.25 12.625 13.5 10.625 12.75 9.125C11.25 8.125 9.75004 7.875 9.75004 7.875V10.125Z" fill="currentColor"></path>
    <path d="M22.25 10.125C23.75 11.125 25.25 13.875 23.25 15.625C22.8572 13.4646 22.3101 12.7854 21.6087 11.9146C21.4172 11.677 21.2144 11.4251 21 11.125L18.75 12.625C18.75 12.625 18.5 10.625 19.25 9.125C20.75 8.125 22.25 7.875 22.25 7.875V10.125Z" fill="currentColor"></path>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M11 13.125C9 15.125 9.25 17.125 9.25 17.125C7.75 15.125 5.25 14.625 3.25 14.625C4.12371 16.3724 5.7608 18.2153 7.39008 20.0493C9.49035 22.4136 11.5776 24.7632 12 26.875V22.125C12 22.125 13.75 23.625 16 24.375C18.25 23.625 20 22.125 20 22.125V26.875C20.4224 24.7632 22.5096 22.4136 24.6099 20.0493C26.2392 18.2153 27.8763 16.3724 28.75 14.625C26.75 14.625 24.25 15.125 22.75 17.125C22.75 17.125 23 15.125 21 13.125C21 13.125 19.75 15.625 16 16.625C12.25 15.625 11 13.125 11 13.125ZM10.6135 16.9637C12.9319 17.7524 14.0552 18.8518 14.2942 20.5726C11.2589 20.2141 10.6135 18.5651 10.6135 16.9637ZM21.3865 16.9637C19.0681 17.7524 17.9448 18.8518 17.7058 20.5726C20.7411 20.2141 21.3865 18.5651 21.3865 16.9637Z"
      fill="currentColor"
    ></path>
  </svg>
);
const TowerIcon = ({ className = "" }) => (
  <svg viewBox="0 0 32 32" className={`inline-block text-lime-400 ${className}`} xmlns="http://www.w3.org/2000/svg">
    <path fillRule="evenodd" clipRule="evenodd" d="M22.5068 10.3065L16 3.79968L9.49317 10.3065L11.3867 12.2001H8L16 20.2001L24 12.2001H20.6133L22.5068 10.3065ZM19.8207 10.3064L16 6.48567L12.1793 10.3064L16 14.1271L19.8207 10.3064Z" fill="currentColor"></path>
    <path d="M13.1429 28.2001L10.2857 15.6286L16 22.4858L21.7143 15.6286L18.8571 28.2001H13.1429Z" fill="currentColor"></path>
  </svg>
);
// --- END OBJECTIVE ICONS ---

// --- NEW STAT SECTION ICONS ---
const LaningPhaseIcon = ({ className = "w-5 h-5" }) => (
  <svg width="32" height="32" viewBox="0 0 32 32" className={`${className} text-lime-400`} xmlns="http://www.w3.org/2000/svg">
    <path d="M7.92988 4.37281C7.92988 5.68327 6.86754 6.74561 5.55707 6.74561C4.24661 6.74561 3.18427 5.68327 3.18427 4.37281C3.18427 3.06234 4.24661 2 5.55707 2C6.86754 2 7.92988 3.06234 7.92988 4.37281Z" fill="currentColor"></path>
    <path d="M8.29558 9.81035C7.64287 9.0248 6.65854 8.52463 5.5574 8.52463C3.61985 8.52463 2.04399 10.0732 2 12.0002H9.00609L12.1056 8.51031C11.7271 8.32416 11.3012 8.21961 10.8509 8.21961C9.72953 8.21961 8.7596 8.86801 8.29558 9.81035Z" fill="currentColor"></path>
    <path d="M12.7485 4.89822C12.7485 5.94659 11.8987 6.79645 10.8503 6.79645C9.80196 6.79645 8.9521 5.94659 8.9521 4.89822C8.9521 3.84986 9.80196 3 10.8503 3C11.8987 3 12.7485 3.84986 12.7485 4.89822Z" fill="currentColor"></path>
    <path d="M3.99952 24.5L6.49953 27L10.4522 23.4527L12.4995 25.5L14.9995 23L13.0874 21.0878L25.9995 9.5V5H21.4995L9.91169 17.9122L7.99952 16L5.49952 18.5L7.54682 20.5473L3.99952 24.5Z" fill="currentColor"></path>
    <path d="M23.0696 21.3728C23.0696 22.6833 24.132 23.7456 25.4424 23.7456C26.7529 23.7456 27.8153 22.6833 27.8153 21.3728C27.8153 20.0623 26.7529 19 25.4424 19C24.132 19 23.0696 20.0623 23.0696 21.3728Z" fill="currentColor"></path>
    <path d="M22.3702 27.286C22.9879 26.2322 24.1324 25.5246 25.4421 25.5246C27.3797 25.5246 28.9555 27.0732 28.9995 29.0002L17.3029 28.9999C17.3381 27.4584 18.5988 26.2196 20.1488 26.2196C21.0472 26.2196 21.8485 26.6359 22.3702 27.286Z" fill="currentColor"></path>
    <path d="M18.2511 22.8982C18.2511 23.9466 19.101 24.7964 20.1493 24.7964C21.1977 24.7964 22.0476 23.9466 22.0476 22.8982C22.0476 21.8499 21.1977 21 20.1493 21C19.101 21 18.2511 21.8499 18.2511 22.8982Z" fill="currentColor"></path>
  </svg>
);

const WardsIcon = ({ className = "w-5 h-5" }) => (
  <svg width="32" height="32" viewBox="0 0 32 32" className={`${className} text-yellow-400`} xmlns="http://www.w3.org/2000/svg">
    <path d="M10.593 4.93605L9.70156 4H6.13566L5.24419 4.93605L7.91861 7.74419L10.593 4.93605Z" fill="currentColor"></path>
    <path d="M5.94365 7.82558L4.46244 6.29069H1.5C1.5291 6.33893 1.55778 6.38802 1.58675 6.43761C1.96747 7.0892 2.39772 7.82558 4.46244 7.82558L3.47496 8.84883C3.63321 9.44573 4.22316 10.6395 5.31698 10.6395L5.94365 7.82558Z" fill="currentColor"></path>
    <path d="M9.26712 12.687H6.5701L7.42487 8.84883H8.41235L9.26712 12.687Z" fill="currentColor"></path>
    <path d="M25.4297 12.687H22.7327L23.5875 8.84883H24.5749L25.4297 12.687Z" fill="currentColor"></path>
    <path d="M11.3748 6.29069L9.89357 7.82558L10.5202 10.6395C11.6141 10.6395 12.204 9.44573 12.3623 8.84883L11.3748 7.82558C13.4395 7.82558 13.8698 7.0892 14.2505 6.4376C14.2794 6.38803 14.3081 6.33893 14.3372 6.29069H11.3748Z" fill="currentColor"></path>
    <path d="M26.7556 4.93605L25.8642 4H22.2983L21.4068 4.93605L24.0812 7.74419L26.7556 4.93605Z" fill="currentColor"></path>
    <path d="M22.1063 7.82558L20.625 6.29069H17.6626C17.6917 6.33893 17.7204 6.38802 17.7493 6.43761C18.1301 7.0892 18.5603 7.82558 20.625 7.82558L19.6376 8.84883C19.7958 9.44573 20.3858 10.6395 21.4796 10.6395L22.1063 7.82558Z" fill="currentColor"></path>
    <path d="M27.5374 6.29069L26.0562 7.82558L26.6828 10.6395C27.7767 10.6395 28.3666 9.44573 28.5249 8.84883L27.5374 7.82558C29.6021 7.82558 30.0323 7.0892 30.4131 6.43761C30.442 6.38802 30.4707 6.33893 30.4998 6.29069H27.5374Z" fill="currentColor"></path>
    <path d="M13.2308 28H18.7692L16.6923 18.7462H15.3077L13.2308 28Z" fill="currentColor"></path>
    <path d="M13.2308 17.3225L11.1538 15.187H7C7.57692 16.1362 8.03846 17.3225 11.1538 17.3225L9.76923 18.7462C9.99112 19.5767 10.8183 21.2376 12.3521 21.2376L13.2308 17.3225Z" fill="currentColor"></path>
    <path d="M18.7692 17.3225L20.8462 15.187H25C24.4231 16.1362 23.9615 17.3225 20.8462 17.3225L22.2308 18.7462C22.0089 19.5767 21.1817 21.2376 19.6479 21.2376L18.7692 17.3225Z" fill="currentColor"></path>
    <path d="M19.75 13.3023L18.5 12H13.5L12.25 13.3023L16 17.2093L19.75 13.3023Z" fill="currentColor"></path>
  </svg>
);

const GlobalStatsIcon = ({ className = "w-5 h-5" }) => (
  <svg width="32" height="32" viewBox="0 0 32 32" className={`${className} text-cyan-300`} xmlns="http://www.w3.org/2000/svg">
    <path d="M8 14C8 9.58172 10 7 16 5C22 7 24 9.58172 24 14V16.7243L19.8297 21.3712C19.9432 20.192 20 19.0108 20 18C20 18 23 17 23 13C20 13 17 15 17 17V21.5C17 21.7761 16.7761 22 16.5 22H15.5C15.2239 22 15 21.7761 15 21.5V17C15 15 12 13 9 13C9 17 12 18 12 18C12 21 12.5 25.5 13.5 27C8.5 27 7 23 7 21.5C7.5 21.5 8 20.5 8 19V14Z" fill="currentColor"></path>
    <path d="M18 28.6364L19.3636 30L21.5197 28.0651L22.6364 29.1818L24 27.8182L22.957 26.7752L30 20.4545L30 18H27.5455L21.2248 25.043L20.1818 24L18.8182 25.3636L19.9349 26.4803L18 28.6364Z" fill="currentColor"></path>
  </svg>
);
// --- END NEW STAT SECTION ICONS ---

// --- RANK DISPLAY HELPER COMPONENT ---
const RankDisplay = ({ rankInfo }) => {
  // 1. Handle Unranked case
  if (!rankInfo || !rankInfo.tier || rankInfo.tier === "UNRANKED") {
    return <span className="text-gray-500 text-[10px]">Unranked</span>;
  }

  const { tier, rank, leaguePoints } = rankInfo;
  const highTiers = ["MASTER", "GRANDMASTER", "CHALLENGER"];
  const isHighTier = highTiers.includes(tier.toUpperCase());

  const iconSrc = rankIconMap[tier.toUpperCase()];
  const tooltipText = isHighTier ? `${tier} ${leaguePoints} LP` : `${tier} ${rank}`;

  // 2. Fallback to text if an icon is missing for an unexpected new rank
  if (!iconSrc) {
    return <span className="text-gray-400 text-[10px] capitalize">{tooltipText}</span>;
  }

  // 3. Render icon and conditional text
  return (
    <div className="flex items-center" title={tooltipText}>
      <img src={iconSrc} alt={tooltipText} className="h-5 w-5" />
      {isHighTier && <span className="text-gray-300 text-[10px] font-semibold ml-1.5">{leaguePoints} LP</span>}
    </div>
  );
};

// --- SKILL ICON LOGIC ---
const SKILL_PLACEHOLDER_TEXT = {
  1: "Q",
  2: "W",
  3: "E",
  4: "R",
};

const SKILL_ROW_ACTIVE_COLORS = {
  1: "bg-blue-500/80 text-white",
  2: "bg-orange-500/80 text-white",
  3: "bg-purple-500/80 text-white",
  4: "bg-rose-500/80 text-white",
};

const getSkillIconUrl = (ddragonVersion, championDdragonId, skillSlot) => {
  if (!ddragonVersion || !championDdragonId || !skillSlot) return null;
  const skillKeyChar = SKILL_PLACEHOLDER_TEXT[skillSlot]?.toLowerCase();
  if (!skillKeyChar) return null;
  return `https://cdn.communitydragon.org/latest/champion/${championDdragonId}/ability-icon/${skillKeyChar}`;
};

const SkillIconDisplay = ({ ddragonVersion, championDdragonId, skillSlotKey }) => {
  const [imgError, setImgError] = useState(false);
  const skillIconUrl = getSkillIconUrl(ddragonVersion, championDdragonId, skillSlotKey);
  const skillAltText = SKILL_PLACEHOLDER_TEXT[skillSlotKey] || "?";

  useEffect(() => {
    setImgError(false);
  }, [skillIconUrl]);

  if (!skillIconUrl || imgError) {
    return <span className="text-xs font-semibold text-gray-400">{skillAltText}</span>;
  }

  return <img src={skillIconUrl} alt={skillAltText} className="w-full h-full object-contain" onError={() => setImgError(true)} />;
};
// --- END SKILL ICON LOGIC ---

// --- RUNE DEFINITIONS & HELPERS ---
const LOCAL_STAT_SHARD_ICONS = {
  StatModsAdaptiveForceIcon: statModsAdaptiveForceIcon,
  StatModsAttackSpeedIcon: statModsAttackSpeedIcon,
  StatModsCDRScalingIcon: statModsCDRScalingIcon,
  StatModsHealthFlatIcon: statModsHealthFlatIcon,
  StatModsMovementSpeedIcon: statModsMovementSpeedIcon,
  StatModsTenacityIcon: statModsTenacityIcon,
  StatModsHealthPlusIcon: statModsHealthPlusIcon,
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
  if (localIcon) {
    return localIcon;
  }
  console.warn(`Local stat shard icon not found for: ${iconName}. Using placeholder.`);
  return `https://placehold.co/20x20/1a1a1a/4a4a4a?text=${iconName ? iconName.substring(0, 1) : "S"}`;
};

const RUNE_TREE_COLORS = {
  8000: "border-yellow-400", // Precision
  8100: "border-red-500", // Domination
  8200: "border-blue-400", // Sorcery
  8400: "border-green-400", // Resolve
  8300: "border-teal-400", // Inspiration
};

// Component for expanded match details
const ExpandedMatchDetails = ({ match, ddragonVersion, championData, summonerSpellsMap, runesMap, runesDataFromDDragon, getChampionImage, getSummonerSpellImage, getItemImage, getRuneImage, getChampionDisplayName, isTrackedPlayerWin, roleIconMap, roleOrder, processTimelineDataForPlayer }) => {
  const [activeTab, setActiveTab] = useState("General");
  const [selectedPlayerForDetailsPuuid, setSelectedPlayerForDetailsPuuid] = useState(match.puuid);
  const [currentSelectedPlayerTimeline, setCurrentSelectedPlayerTimeline] = useState(null);

  const { allParticipants = [], teamObjectives = [], gameDuration, puuid: trackedPlayerPuuid, processedTimelineForTrackedPlayer, rawTimelineFrames, matchId } = match;

  useEffect(() => {
    setSelectedPlayerForDetailsPuuid(trackedPlayerPuuid);
    setCurrentSelectedPlayerTimeline(processedTimelineForTrackedPlayer || null);
    setActiveTab("General");
  }, [matchId, trackedPlayerPuuid, processedTimelineForTrackedPlayer]);

  useEffect(() => {
    if (activeTab !== "Details") return;

    if (selectedPlayerForDetailsPuuid === trackedPlayerPuuid) {
      setCurrentSelectedPlayerTimeline(processedTimelineForTrackedPlayer || null);
    } else if (rawTimelineFrames && processTimelineDataForPlayer && selectedPlayerForDetailsPuuid && allParticipants.length > 0) {
      const selectedParticipant = allParticipants.find((p) => p.puuid === selectedPlayerForDetailsPuuid);
      if (selectedParticipant) {
        const targetParticipantId = allParticipants.findIndex((p) => p.puuid === selectedPlayerForDetailsPuuid) + 1;

        let opponentForSelected = null;
        let opponentIdForSelectedTimeline = null;
        if (selectedParticipant.teamPosition && selectedParticipant.teamPosition !== "") {
          opponentForSelected = allParticipants.find((p) => p.teamId !== selectedParticipant.teamId && p.teamPosition === selectedParticipant.teamPosition);
        }
        if (opponentForSelected) {
          opponentIdForSelectedTimeline = allParticipants.findIndex((p) => p.puuid === opponentForSelected.puuid) + 1;
        }

        if (targetParticipantId > 0) {
          const timeline = processTimelineDataForPlayer(rawTimelineFrames, targetParticipantId, opponentIdForSelectedTimeline, gameDuration);
          setCurrentSelectedPlayerTimeline(timeline);
        } else {
          setCurrentSelectedPlayerTimeline(null);
        }
      } else {
        setCurrentSelectedPlayerTimeline(null);
      }
    } else {
      setCurrentSelectedPlayerTimeline(null);
    }
  }, [selectedPlayerForDetailsPuuid, activeTab, rawTimelineFrames, processTimelineDataForPlayer, allParticipants, trackedPlayerPuuid, processedTimelineForTrackedPlayer, gameDuration]);

  const blueTeam = allParticipants.filter((p) => p.teamId === 100).sort((a, b) => roleOrder.indexOf(a.teamPosition?.toUpperCase()) - roleOrder.indexOf(b.teamPosition?.toUpperCase()));
  const redTeam = allParticipants.filter((p) => p.teamId === 200).sort((a, b) => roleOrder.indexOf(a.teamPosition?.toUpperCase()) - roleOrder.indexOf(b.teamPosition?.toUpperCase()));

  const blueTeamData = teamObjectives.find((t) => t.teamId === 100) || { objectives: {}, win: false };
  const redTeamData = teamObjectives.find((t) => t.teamId === 200) || { objectives: {}, win: false };

  const maxDamageInGame = Math.max(...allParticipants.map((p) => p.totalDamageDealtToChampions || 0), 0);
  const maxDamageBlueTeam = Math.max(0, ...blueTeam.map((p) => p.totalDamageDealtToChampions || 0));
  const maxDamageRedTeam = Math.max(0, ...redTeam.map((p) => p.totalDamageDealtToChampions || 0));

  const gamePatch = useMemo(() => {
    if (match.gamePatchVersion && match.gamePatchVersion !== "N/A") {
      return match.gamePatchVersion;
    }
    if (ddragonVersion) {
      const parts = ddragonVersion.split(".");
      if (parts.length >= 2) {
        return `${parts[0]}.${parts[1]}`;
      }
      return ddragonVersion;
    }
    return "N/A";
  }, [match.gamePatchVersion, ddragonVersion]);

  const renderPlayerRow = (player, teamTotalKills, isTopDamageInTeam, isTrackedPlayerRow) => {
    const items = [player.item0, player.item1, player.item2, player.item3, player.item4, player.item5];
    const trinket = player.item6;
    const kdaColor = getKDAColorClass(player.kills, player.deaths, player.assists);
    const kdaRatio = gameDuration > 0 ? (player.deaths === 0 ? (player.kills > 0 || player.assists > 0 ? "Perfect" : "0.00") : ((player.kills + player.assists) / player.deaths).toFixed(2)) : "0.00";
    const kp = teamTotalKills > 0 ? (((player.kills + player.assists) / teamTotalKills) * 100).toFixed(0) + "%" : "0%";
    const cs = (player.totalMinionsKilled || 0) + (player.neutralMinionsKilled || 0);
    const csPerMin = gameDuration > 0 ? (cs / (gameDuration / 60)).toFixed(1) : "0.0";
    const damageDealt = player.totalDamageDealtToChampions || 0;
    const damagePerMin = gameDuration > 0 ? (damageDealt / (gameDuration / 60)).toFixed(0) : "0";
    const damagePercentage = maxDamageInGame > 0 ? (damageDealt / maxDamageInGame) * 100 : 0;

    const playerPrimaryRune = player.perks?.styles?.find((s) => s.description === "primaryStyle")?.selections?.[0]?.perk;
    const playerSubStyle = player.perks?.styles?.find((s) => s.description === "subStyle")?.style;
    const roleIcon = roleIconMap[player.teamPosition?.toUpperCase()];

    const damageTextColorClass = isTopDamageInTeam ? "text-white font-semibold" : "text-gray-200";
    const damageBarColorClass = isTopDamageInTeam ? (player.teamId === 100 ? "neon-bg-blue" : "neon-bg-red") : player.teamId === 100 ? "bg-blue-500" : "bg-red-500";

    const trackedPlayerClass = isTrackedPlayerRow ? "tracked-player-highlight" : "";

    const playerRankInfo = player.rankInfo;

    return (
      <div key={player.puuid || player.summonerName} className={`flex items-center gap-x-2 sm:gap-x-3 py-0.5 px-1 text-xs hover:bg-gray-700/10 transition-colors duration-150 ${trackedPlayerClass}`}>
        <div className="flex items-center space-x-1.5 w-[120px] sm:w-[140px] flex-shrink-0">
          <div className="relative w-9 h-9 flex-shrink-0">
            <img
              src={getChampionImage(player.championName)}
              alt={getChampionDisplayName(player.championName)}
              className="w-full h-full rounded-md border border-gray-600"
              onError={(e) => {
                e.target.src = `https://placehold.co/36x36/222/ccc?text=${player.championName ? player.championName.substring(0, 1) : "?"}`;
              }}
            />
            <span className="absolute -bottom-1 -right-1 bg-black bg-opacity-80 text-white text-[9px] px-1 rounded-sm leading-tight border border-gray-500/50">{player.champLevel}</span>
            {roleIcon && <img src={roleIcon} alt={player.teamPosition || "Role"} className="absolute -top-1 -left-1 w-4 h-4 p-0.5 bg-gray-800 rounded-full border border-gray-400/70 shadow-sm" />}
          </div>
          <div className="flex flex-col justify-center overflow-hidden">
            <span className="font-semibold text-gray-100 truncate" title={player.riotIdGameName ? `${player.riotIdGameName}#${player.riotIdTagline}` : player.summonerName}>
              {player.riotIdGameName || player.summonerName || "Player"}
            </span>
            <div className="h-5 flex items-center">
              <RankDisplay rankInfo={playerRankInfo} />
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-1 flex-shrink-0">
          <div className="flex flex-col space-y-0.5">
            <div className="w-5 h-5 bg-black/30 rounded border border-gray-600 flex items-center justify-center">
              <img src={getSummonerSpellImage(player.summoner1Id)} alt="S1" className="w-full h-full rounded-sm" onError={(e) => (e.target.style.display = "none")} />
            </div>
            <div className="w-5 h-5 bg-black/30 rounded border border-gray-600 flex items-center justify-center">
              <img src={getSummonerSpellImage(player.summoner2Id)} alt="S2" className="w-full h-full rounded-sm" onError={(e) => (e.target.style.display = "none")} />
            </div>
          </div>
          <div className="flex flex-col space-y-0.5">
            <div className="w-5 h-5 bg-black/30 rounded border border-gray-600 flex items-center justify-center">
              <img src={getRuneImage(playerPrimaryRune)} alt="R1" className="w-full h-full object-contain" onError={(e) => (e.target.style.display = "none")} />
            </div>
            <div className="w-5 h-5 bg-black/30 rounded border border-gray-600 flex items-center justify-center p-0.5">
              <img src={getRuneImage(playerSubStyle)} alt="R2" className="w-full h-full object-contain" onError={(e) => (e.target.style.display = "none")} />
            </div>
          </div>
          <div className="flex flex-col space-y-0.5">
            <div className="flex space-x-0.5">
              {[items[0], items[1], items[2], trinket].map((item, idx) => (
                <div key={`item-top-${idx}-${player.puuid}`} className="w-5 h-5 bg-black/30 rounded border border-gray-600 flex items-center justify-center">
                  {item && item !== 0 ? <img src={getItemImage(item)} alt={`Item ${idx}`} className="w-full h-full rounded-sm" /> : <div className="w-4 h-4 bg-gray-700/50 rounded-sm"></div>}
                </div>
              ))}
            </div>
            <div className="flex space-x-0.5">
              {[items[3], items[4], items[5]].map((item, idx) => (
                <div key={`item-bot-${idx}-${player.puuid}`} className="w-5 h-5 bg-black/30 rounded border border-gray-600 flex items-center justify-center">
                  {item && item !== 0 ? <img src={getItemImage(item)} alt={`Item ${idx + 3}`} className="w-full h-full rounded-sm" /> : <div className="w-4 h-4 bg-gray-700/50 rounded-sm"></div>}
                </div>
              ))}
              <div className="w-5 h-5"></div>
            </div>
          </div>
        </div>

        <div className="flex flex-1 justify-around items-start gap-x-1 sm:gap-x-2 text-center min-w-0">
          <div className="flex flex-col items-center min-w-[55px] sm:min-w-[65px]">
            <span className="text-gray-100">{getKDAStringSpans(player)}</span>
            <div>
              <span className={`text-xs ${kdaColor}`}>{kdaRatio}</span>
              <span className="text-[10px] text-gray-300 ml-0.5 sm:ml-1">KDA</span>
            </div>
          </div>
          <div className="flex flex-col items-center min-w-[30px] sm:min-w-[35px]">
            <span className="text-gray-200">{kp}</span>
            <span className="text-[10px] text-gray-300">KP</span>
          </div>
          <div className="flex flex-col items-center min-w-[55px] sm:min-w-[65px]">
            <span className="text-gray-200">{cs}</span>
            <span className="text-[10px] text-gray-300">{csPerMin} CS/m</span>
          </div>
          <div className="flex flex-col items-center flex-grow min-w-[70px] sm:min-w-[90px] max-w-[120px]">
            <div className="flex justify-between w-full items-baseline">
              <span className={`${damageTextColorClass} text-[10px]`}>{damageDealt.toLocaleString()}</span>
              <span className="text-gray-300 text-[9px]">{damagePerMin} DPM</span>
            </div>
            <div className="h-1.5 bg-gray-500 rounded-full w-full overflow-hidden my-0.5">
              <div className={`h-full ${damageBarColorClass}`} style={{ width: `${damagePercentage}%` }}></div>
            </div>
          </div>
          <div className="flex flex-col items-center min-w-[50px] sm:min-w-[60px]">
            <span className="text-gray-200">{player.visionWardsBoughtInGame || 0}</span>
            <span className="text-[10px] text-gray-300">
              {player.wardsPlaced || 0}/{player.wardsKilled || 0}
            </span>
          </div>
        </div>
      </div>
    );
  };

  const renderTeamSection = (team, teamData, teamName, teamMaxDamage) => {
    const totalKills = teamData?.objectives?.champion?.kills || 0;
    const teamSide = teamName === "Blue Team" ? "Blue Side" : "Red Side";
    const teamColorForText = teamName === "Blue Team" ? "text-blue-400" : "text-red-400";
    const objectiveIconSize = "w-5 h-5";

    return (
      <div className="px-2 sm:px-3 py-2 mb-0 rounded-md">
        <div className="flex items-center justify-between pb-1">
          <div className="flex items-center">
            <h3 className={`text-md sm:text-lg font-semibold ${teamColorForText}`}>
              {teamData.win ? "Victory" : "Defeat"}
              <span className="text-xs sm:text-sm text-gray-400 font-normal ml-1.5 mr-2 sm:mr-3">({teamSide})</span>
            </h3>
            <div className="flex space-x-1.5 sm:space-x-2 items-center text-xs">
              <span title="Voidgrubs" className="flex items-center">
                <GrubIcon className={`${objectiveIconSize} mr-0.5`} /> {teamData.objectives?.horde?.kills || 0}
              </span>
              <span title="Dragons" className="flex items-center">
                <DragonIcon className={`${objectiveIconSize} mr-0.5`} /> {teamData.objectives?.dragon?.kills || 0}
              </span>
              <span title="Barons" className="flex items-center">
                <BaronIcon className={`${objectiveIconSize} mr-0.5`} /> {teamData.objectives?.baron?.kills || 0}
              </span>
              <span title="Heralds" className="flex items-center">
                <HeraldIcon className={`${objectiveIconSize} mr-0.5`} /> {teamData.objectives?.riftHerald?.kills || 0}
              </span>
              {teamData.objectives?.elderDragon?.kills > 0 && (
                <span title="Elder Dragons" className="flex items-center">
                  <ElderDragonIcon className={`${objectiveIconSize} mr-0.5`} /> {teamData.objectives.elderDragon.kills || 0}
                </span>
              )}
              <span title="Towers" className="flex items-center">
                <TowerIcon className={`${objectiveIconSize} mr-0.5`} /> {teamData.objectives?.tower?.kills || 0}
              </span>
            </div>
          </div>
          {teamName === "Blue Team" && <span className="text-xs text-gray-500 ml-auto pl-2">v{gamePatch}</span>}
        </div>
        {team.map((player) => renderPlayerRow(player, totalKills, player.totalDamageDealtToChampions === teamMaxDamage && teamMaxDamage > 0, player.puuid === trackedPlayerPuuid))}
      </div>
    );
  };

  const GeneralTabContent = () => (
    <div className="space-y-3">
      {renderTeamSection(blueTeam, blueTeamData, "Blue Team", maxDamageBlueTeam)}
      {renderTeamSection(redTeam, redTeamData, "Red Team", maxDamageRedTeam)}
    </div>
  );

  // --- RUNES TAB CONTENT ---
  const RunesTabContent = () => {
    const currentPlayer = allParticipants.find((p) => p.puuid === selectedPlayerForDetailsPuuid);
    if (!currentPlayer || !currentPlayer.perks || !runesDataFromDDragon || runesDataFromDDragon.length === 0) {
      return <p className="text-gray-400 p-4 text-center">Rune data not available for this player or DDragon data missing.</p>;
    }

    const perks = currentPlayer.perks;
    const primaryStyleData = perks.styles?.find((s) => s.description === "primaryStyle");
    const secondaryStyleData = perks.styles?.find((s) => s.description === "subStyle");

    if (!primaryStyleData) {
      return <p className="text-gray-400 p-4 text-center">Primary rune style not found.</p>;
    }

    const primaryTree = runesDataFromDDragon.find((tree) => tree.id === primaryStyleData.style);
    const secondaryTree = secondaryStyleData ? runesDataFromDDragon.find((tree) => tree.id === secondaryStyleData.style) : null;

    const selectedPrimaryRuneIds = primaryStyleData.selections.map((sel) => sel.perk);
    const selectedSecondaryRuneIds = secondaryStyleData ? secondaryStyleData.selections.map((sel) => sel.perk) : [];

    const renderRuneTreeDisplay = (tree, selectedPerkIds, isPrimaryTree) => {
      if (!tree) return null;
      const slotsToRender = isPrimaryTree ? tree.slots : tree.slots.slice(1, 4);
      const runeImageSize = isPrimaryTree ? "w-7 h-7" : "w-6 h-6";
      const keystoneImageSize = "w-9 h-9";
      const treeBorderColor = RUNE_TREE_COLORS[tree.id] || "border-gray-500";

      return (
        <div className={`flex flex-col items-center ${isPrimaryTree ? "space-y-2.5" : "space-y-1.5"} rounded-md`}>
          <div className="flex items-center space-x-2 mb-2">
            <img src={getRuneImage(tree.id)} alt={tree.name} className="w-6 h-6" onError={(e) => (e.target.style.display = "none")} />
            <span className="text-sm font-semibold text-gray-200">{tree.name}</span>
          </div>
          {slotsToRender.map((slot, slotIndexInOriginalArray) => {
            const isKeystoneRow = isPrimaryTree && slotIndexInOriginalArray === 0;
            return (
              <div key={`${tree.id}-slot-${slotIndexInOriginalArray}`} className="flex justify-center space-x-1">
                {slot.runes.map((rune) => {
                  const isActive = selectedPerkIds.includes(rune.id);
                  let currentRuneSize = isKeystoneRow ? keystoneImageSize : runeImageSize;
                  currentRuneSize = slot.runes.length >= 4 ? "w-8 h-8" : currentRuneSize;

                  let activeRuneClasses = "";
                  if (isActive) {
                    if (isKeystoneRow) {
                      activeRuneClasses = "scale-105 shadow-md opacity-100";
                    } else {
                      activeRuneClasses = `${treeBorderColor} scale-105 shadow-md opacity-100 border-2`;
                    }
                  } else {
                    activeRuneClasses = "border-transparent opacity-100 hover:opacity-100";
                  }

                  return (
                    <div key={rune.id} className={`relative p-0 rounded-full transition-all duration-150 ${activeRuneClasses}`} title={runesMap[rune.id]?.name || rune.name}>
                      <img
                        src={getRuneImage(rune.id)}
                        alt={runesMap[rune.id]?.name || rune.name}
                        className={`${currentRuneSize} rounded-full ${isActive ? "" : "filter grayscale brightness-75"}`}
                        onError={(e) => {
                          e.target.src = `https://placehold.co/32x32/1a1a1a/4a4a4a?text=${rune.name ? rune.name.substring(0, 1) : "R"}`;
                        }}
                      />
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
      const selectedOffense = perks.statPerks?.offense;
      const selectedFlex = perks.statPerks?.flex;
      const selectedDefense = perks.statPerks?.defense;

      return (
        <div className="flex flex-col items-center space-y-1 mt-0.5 pt-1 w-full rounded-md">
          {[
            { options: STAT_SHARD_ROWS[0], selected: selectedOffense },
            { options: STAT_SHARD_ROWS[1], selected: selectedFlex },
            { options: STAT_SHARD_ROWS[2], selected: selectedDefense },
          ].map((row, rowIndex) => (
            <div key={`stat-shard-row-${rowIndex}`} className="flex justify-center space-x-2.5 items-center">
              {row.options.map((shard) => {
                const isActive = shard.id === row.selected;
                const shardIconSrc = getStatShardImage(shard.iconName);
                const activeShardClasses = isActive ? "border-yellow-400 scale-105 opacity-100 border-2" : "border-transparent opacity-100 hover:opacity-100 filter grayscale brightness-75";

                return (
                  <div key={shard.id} className={`p-0 rounded-full transition-all duration-150 ${activeShardClasses}`} title={shard.name}>
                    {shardIconSrc ? <img src={shardIconSrc} alt={shard.name} className="w-4 h-4 rounded-full" /> : <div className="w-4 h-4 rounded-full bg-gray-600 flex items-center justify-center text-xs text-gray-400">?</div>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      );
    };

    return (
      <div className="bg-gray-800/40 p-2 sm:p-3 rounded-lg border border-gray-700/50">
        <div className="flex flex-col md:flex-row justify-center items-start gap-0.5 md:gap-10">
          <div className="w-full md:w-auto">{renderRuneTreeDisplay(primaryTree, selectedPrimaryRuneIds, true)}</div>
          <div className="w-full md:w-auto flex flex-col space-y-1">
            {secondaryTree && renderRuneTreeDisplay(secondaryTree, selectedSecondaryRuneIds, false)}
            <hr className="border-gray-700 my-0.5 w-11/12 mx-auto" />
            {renderStatShardsDisplay()}
          </div>
        </div>
      </div>
    );
  };
  // --- END RUNES TAB CONTENT ---

  const DetailsTabContent = () => {
    const currentPlayerForDisplay = allParticipants.find((p) => p.puuid === selectedPlayerForDetailsPuuid);

    if (!currentPlayerForDisplay) return <p className="text-gray-400 p-4">Player data not found for selection.</p>;
    if (!currentSelectedPlayerTimeline && activeTab === "Details") {
      return <div className="p-4 text-center text-gray-400">Loading player details...</div>;
    }

    const timelineToDisplay = currentSelectedPlayerTimeline;
    const snapshot14min = timelineToDisplay?.snapshots?.find((s) => s.minute === 14);

    const StatItem = ({ value, label, title }) => (
      <div className="flex flex-col items-center text-center" title={title}>
        <span className="text-gray-100 font-medium text-sm">{value !== undefined && value !== null ? value : "N/A"}</span>
        <span className="text-gray-400 text-[10px] leading-tight">{label}</span>
      </div>
    );

    const renderChampionIconWithRole = (player) => {
      const roleIconSrc = roleIconMap[player.teamPosition?.toUpperCase()];
      const isSelected = player.puuid === selectedPlayerForDetailsPuuid;
      return (
        <button
          key={player.puuid}
          className={`relative w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0 focus:outline-none transition-all duration-150 p-0.5
                                ${isSelected ? "bg-white/20 rounded-md scale-110 shadow-lg" : "opacity-75 hover:opacity-100"}`}
          title={`Show stats for ${getChampionDisplayName(player.championName)}`}
          onClick={() => setSelectedPlayerForDetailsPuuid(player.puuid)}
        >
          <img
            src={getChampionImage(player.championName)}
            alt={getChampionDisplayName(player.championName)}
            className="w-full h-full rounded-md border-2 border-gray-600"
            onError={(e) => {
              e.target.src = `https://placehold.co/48x48/222/ccc?text=${player.championName ? player.championName.substring(0, 1) : "?"}`;
            }}
          />
          {roleIconSrc && <img src={roleIconSrc} alt={player.teamPosition || "Role"} className="absolute -bottom-1 -left-1 w-4 h-4 p-0.5 bg-gray-900 rounded-full border border-gray-500" />}
        </button>
      );
    };

    const groupedBuildOrder =
      timelineToDisplay?.buildOrder?.reduce((acc, itemEvent) => {
        const minuteKey = Math.floor(itemEvent.timestamp / (1000 * 60));
        if (!acc[minuteKey]) {
          acc[minuteKey] = {
            items: [],
            firstTimestampMs: itemEvent.timestamp,
          };
        }
        acc[minuteKey].items.push(itemEvent);
        if (itemEvent.timestamp < acc[minuteKey].firstTimestampMs) {
          acc[minuteKey].firstTimestampMs = itemEvent.timestamp;
        }
        return acc;
      }, {}) || {};

    const skillLevelsByAbility = { 1: [], 2: [], 3: [], 4: [] };
    const currentPointsInSkill = { 1: 0, 2: 0, 3: 0, 4: 0 };

    if (timelineToDisplay?.skillOrder && Array.isArray(timelineToDisplay.skillOrder)) {
      const sortedSkillOrderEvents = [...timelineToDisplay.skillOrder].sort((a, b) => {
        if (a.levelTakenAt === b.levelTakenAt) {
          return a.timestamp - b.timestamp;
        }
        return a.levelTakenAt - b.levelTakenAt;
      });

      for (let champLvl = 1; champLvl <= 18; champLvl++) {
        const eventThisLevel = sortedSkillOrderEvents.find((event) => event.levelTakenAt === champLvl);

        if (eventThisLevel) {
          currentPointsInSkill[eventThisLevel.skillSlot] = eventThisLevel.skillLevel;
        }

        for (const slot of [1, 2, 3, 4]) {
          skillLevelsByAbility[slot][champLvl - 1] = currentPointsInSkill[slot] > 0 ? currentPointsInSkill[slot] : undefined;
        }
      }
    }

    // Prepare final build items, filtering out empty slots
    const finalBuildItemsRaw = [currentPlayerForDisplay.item0, currentPlayerForDisplay.item1, currentPlayerForDisplay.item2, currentPlayerForDisplay.item3, currentPlayerForDisplay.item4, currentPlayerForDisplay.item5];
    const finalBuildItemsFiltered = finalBuildItemsRaw.filter((itemId) => itemId && itemId !== 0);
    const finalTrinketItem = currentPlayerForDisplay.item6;

    return (
      <div className="p-2 sm:p-3 text-gray-200 space-y-3">
        {/* Player Selection */}
        <div className="flex items-center justify-center space-x-2 sm:space-x-5 mb-1 p-2 rounded-lg bg-gray-800/20">
          <div className="flex space-x-1 sm:space-x-3.5">{blueTeam.slice(0, 5).map((player) => renderChampionIconWithRole(player))}</div>
          <span className="text-gray-400 font-bold text-sm sm:text-md">VS</span>
          <div className="flex space-x-1 sm:space-x-3.5">{redTeam.slice(0, 5).map((player) => renderChampionIconWithRole(player))}</div>
        </div>

        {/* Stat Blocks */}
        {/* MODIFIED: Changed grid to an 8-column layout */}
        <div className="grid grid-cols-1 md:grid-cols-8 gap-2 sm:gap-3">
          {/* MODIFIED: This container now spans 3 of the 8 columns */}
          <div className="bg-gray-800/40 px-3 py-1.5 rounded-lg border border-gray-700/50 flex flex-col md:col-span-3">
            <h4 className="text-xs font-semibold uppercase text-gray-400 mb-1.5 text-center flex items-center justify-center">
              <LaningPhaseIcon className="w-4 h-4 mr-1.5" />
              Laning Phase (at 14 min)
            </h4>
            {timelineToDisplay && timelineToDisplay.snapshots && timelineToDisplay.snapshots.length > 0 && snapshot14min ? (
              <div className="grid grid-cols-4 gap-x-2 sm:gap-x-2.5 gap-y-1">
                <StatItem value={snapshot14min?.diff?.cs !== undefined ? (snapshot14min.diff.cs > 0 ? `+${snapshot14min.diff.cs}` : snapshot14min.diff.cs) : "N/A"} label="CS Diff" />
                <StatItem value={snapshot14min?.diff?.gold !== undefined ? (snapshot14min.diff.gold > 0 ? `+${snapshot14min.diff.gold.toLocaleString()}` : snapshot14min.diff.gold.toLocaleString()) : "N/A"} label="Gold Diff" />
                <StatItem value={snapshot14min?.diff?.xp !== undefined ? (snapshot14min.diff.xp > 0 ? `+${snapshot14min.diff.xp.toLocaleString()}` : snapshot14min.diff.xp.toLocaleString()) : "N/A"} label="XP Diff" />
                <StatItem value={snapshot14min?.diff?.damage !== undefined ? (snapshot14min.diff.damage > 0 ? `+${snapshot14min.diff.damage.toLocaleString()}` : snapshot14min.diff.damage.toLocaleString()) : "N/A"} label="Dmg Diff" />
              </div>
            ) : (
              <p className="text-gray-500 text-center text-sm italic py-2">Missing laning stats.</p>
            )}
          </div>

          {/* MODIFIED: This container now spans 2 of the 8 columns, making it larger */}
          <div className="bg-gray-800/40 px-3 py-1.5 rounded-lg border border-gray-700/50 flex flex-col md:col-span-2">
            <h4 className="text-xs font-semibold uppercase text-gray-400 mb-1.5 text-center flex items-center justify-center">
              <WardsIcon className="w-4 h-4 mr-1.5" />
              Vision
            </h4>
            <div className="grid grid-cols-3 gap-x-1.5 gap-y-1">
              <StatItem value={currentPlayerForDisplay.wardsPlaced || 0} label="Placed" />
              <StatItem value={currentPlayerForDisplay.wardsKilled || 0} label="Killed" />
              <StatItem value={currentPlayerForDisplay.visionWardsBoughtInGame || 0} label="Controls" />
            </div>
          </div>

          {/* MODIFIED: This container now spans 3 of the 8 columns */}
          <div className="bg-gray-800/40 px-3 py-1.5 rounded-lg border border-gray-700/50 flex flex-col md:col-span-3">
            <h4 className="text-xs font-semibold uppercase text-gray-400 mb-1.5 text-center flex items-center justify-center">
              <GlobalStatsIcon className="w-4 h-4 mr-1.5" />
              Performance
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-2 sm:gap-x-2.5 gap-y-1">
              <StatItem value={gameDuration > 0 ? (((currentPlayerForDisplay.totalMinionsKilled || 0) + (currentPlayerForDisplay.neutralMinionsKilled || 0)) / (gameDuration / 60)).toFixed(1) : "0.0"} label="CS/min" />
              <StatItem value={gameDuration > 0 ? ((currentPlayerForDisplay.visionScore || 0) / (gameDuration / 60)).toFixed(2) : "0.00"} label="VS/min" />
              <StatItem value={gameDuration > 0 ? ((currentPlayerForDisplay.totalDamageDealtToChampions || 0) / (gameDuration / 60)).toFixed(0) : "0"} label="DMG/min" />
              <StatItem value={gameDuration > 0 ? ((currentPlayerForDisplay.goldEarned || 0) / (gameDuration / 60)).toFixed(0) : "0"} label="Gold/min" />
            </div>
          </div>
        </div>

        <div className="bg-gray-800/40 px-2 py-1 rounded-lg border border-gray-700/50 flex flex-col justify-center">
          <h4 className="font-semibold text-gray-300 mb-1.5 text-sm sm:text-sm uppercase">Build Order</h4>
          {timelineToDisplay && timelineToDisplay.buildOrder && timelineToDisplay.buildOrder.length > 0 ? (
            <div className="flex flex-wrap items-start gap-x-0.5 gap-y-1">
              {Object.entries(groupedBuildOrder)
                .sort(([minA], [minB]) => parseInt(minA) - parseInt(minB))
                .map(([minuteKey, groupData], groupIndex, arr) => {
                  const itemsInGroup = groupData.items;
                  const firstItemTimestampMs = groupData.firstTimestampMs;
                  const displayTime = formatGameDurationMMSS(firstItemTimestampMs / 1000);
                  return (
                    <React.Fragment key={`build-group-${minuteKey}`}>
                      <div className="flex flex-col items-center">
                        <div className="flex items-center gap-x-0.5 h-5">
                          {itemsInGroup.map((itemEvent, itemIndex) => {
                            const itemSrc = getItemImage(itemEvent.itemId);
                            const isSold = itemEvent.type === "sold";
                            return itemSrc ? (
                              <div key={`build-${minuteKey}-${itemIndex}-${itemEvent.itemId}-${itemEvent.timestamp}`} className="relative">
                                <img
                                  src={itemSrc}
                                  alt={`Item ${itemEvent.itemId}`}
                                  className={`w-6 h-6 rounded border ${isSold ? "border-red-600/70 opacity-50" : "border-gray-600"}`}
                                  title={`@ ${formatGameDurationMMSS(itemEvent.timestamp / 1000)} (${itemEvent.type})`}
                                  onError={(e) => {
                                    e.target.style.display = "none";
                                  }}
                                />
                                {isSold && <X size={8} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-red-500 stroke-[2px]" />}
                              </div>
                            ) : null;
                          })}
                        </div>
                        <span className="text-[8px] text-gray-300 mt-0.5">{displayTime}</span>
                      </div>
                      {groupIndex < arr.length - 1 && (
                        <div className="flex items-center justify-center h-5 mx-0.5">
                          <ChevronRight size={16} className="text-gray-400" />
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}

              <div className="flex items-center justify-center h-5 mx-0.5">
                <ChevronRight size={16} className="text-gray-400" />
              </div>
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-x-0.5 h-5">
                  {finalBuildItemsFiltered.map((itemId, index) => {
                    const itemSrc = getItemImage(itemId);
                    return itemSrc ? (
                      <img
                        key={`final-item-${index}-${itemId}`}
                        src={itemSrc}
                        alt={`Final Item ${index + 1}`}
                        className="w-6 h-6 rounded border border-gray-500"
                        title={`Item ${itemId}`}
                        onError={(e) => {
                          e.target.style.display = "none";
                        }}
                      />
                    ) : null; // Should not happen due to filter, but good practice
                  })}
                  {/* Trinket */}
                  {finalTrinketItem && finalTrinketItem !== 0 && (
                    <img
                      key={`final-trinket-${finalTrinketItem}`}
                      src={getItemImage(finalTrinketItem)}
                      alt="Final Trinket"
                      className="w-6 h-6 rounded border border-yellow-500/50" // Different border for trinket
                      title={`Trinket ${finalTrinketItem}`}
                      onError={(e) => {
                        e.target.style.display = "none";
                      }}
                    />
                  )}
                </div>
                <span className="text-[8px] text-gray-300 mt-0.5">Final Build</span>
              </div>
            </div>
          ) : (
            <p className="text-gray-500 text-xs italic">Missing build order data.</p>
          )}
        </div>

        <div className="bg-gray-800/40 px-1.5 py-1 rounded-lg border border-gray-700/50">
          <h4 className="font-semibold text-gray-300 mb-1 text-sm sm:text-sm uppercase">Skill Order</h4>
          <div className="space-y-1">
            {[1, 2, 3, 4].map((skillSlotKey) => {
              const championInfo = championData && championData[currentPlayerForDisplay.championName];
              const championDdragonId = championInfo ? championInfo.id : currentPlayerForDisplay.championName;
              const skillKeyBadgeText = SKILL_PLACEHOLDER_TEXT[skillSlotKey];

              return (
                <div key={`skill-row-${skillSlotKey}`} className="flex items-center space-x-2.5">
                  <div className="relative w-6.5 h-6.5 flex-shrink-0 bg-gray-800 rounded border border-gray-600 p-px" title={`Skill ${skillKeyBadgeText}`}>
                    <SkillIconDisplay ddragonVersion={ddragonVersion} championDdragonId={championDdragonId} skillSlotKey={skillSlotKey} />
                    <span
                      className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 flex items-center justify-center
                                                       text-[9px] font-bold rounded-full shadow-sm border border-black/50
                                                       bg-gray-700 text-gray-200`}
                    >
                      {skillKeyBadgeText}
                    </span>
                  </div>
                  <div className="grid grid-cols-[repeat(18,minmax(0,1fr))] gap-0.5 sm:gap-1 flex-grow">
                    {Array.from({ length: 18 }).map((_, levelIndex) => {
                      const championLevel = levelIndex + 1;
                      const skillEventForThisBox = timelineToDisplay?.skillOrder?.find((event) => event.levelTakenAt === championLevel && event.skillSlot === skillSlotKey);
                      const currentTotalPointsInThisSkillSlot = skillLevelsByAbility[skillSlotKey]?.[levelIndex];
                      let boxColor = "bg-gray-600/30";
                      let textColor = "text-gray-400";
                      if (skillEventForThisBox) {
                        boxColor = SKILL_ROW_ACTIVE_COLORS[skillSlotKey] || "bg-orange-500/80 text-white";
                      }
                      return (
                        <div
                          key={`skill-${skillSlotKey}-lvl-${championLevel}`}
                          className={`h-5 sm:h-6 text-[9px] sm:text-[10px] flex items-center justify-center rounded-sm border border-gray-500/30 ${boxColor} transition-colors`}
                          title={skillEventForThisBox ? `Level ${championLevel}: Leveled ${SKILL_PLACEHOLDER_TEXT[skillSlotKey]} (Tier ${skillEventForThisBox.skillLevel})` : currentTotalPointsInThisSkillSlot ? `${SKILL_PLACEHOLDER_TEXT[skillSlotKey]} Tier ${currentTotalPointsInThisSkillSlot}` : `Champ Lvl ${championLevel}`}
                        >
                          <span className={skillEventForThisBox ? SKILL_ROW_ACTIVE_COLORS[skillSlotKey].split(" ").find((cls) => cls.startsWith("text-")) || textColor : textColor}>{skillEventForThisBox ? skillEventForThisBox.levelTakenAt : ""}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          {(!timelineToDisplay?.skillOrder || timelineToDisplay.skillOrder.length === 0) && <p className="text-gray-500 text-xs italic mt-1.5 ml-1">Missing skill order data.</p>}
        </div>

        <RunesTabContent />
      </div>
    );
  };

  const expandedBgClass = "bg-black-800/50";

  let tabBaseBg = "bg-gray-800/25";
  let tabActiveBg = "bg-black-800/40";

  if (isTrackedPlayerWin === true) {
    tabBaseBg = "bg-blue-900/20";
  } else if (isTrackedPlayerWin === false) {
    tabBaseBg = "bg-red-900/20";
  }

  return (
    <div className={`p-2 sm:p-0 ${expandedBgClass} backdrop-blur-sm rounded-b-lg shadow-inner`}>
      <div className={`flex w-full overflow-hidden ${tabBaseBg}`}>
        <button
          onClick={() => setActiveTab("General")}
          className={`flex-1 py-2.5 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm font-medium transition-colors focus:outline-none
                                flex items-center justify-center space-x-2
                                ${activeTab === "General" ? `${tabActiveBg} text-gray-100` : "text-gray-400 hover:text-gray-100 hover:bg-white/5"}`}
        >
          <LayoutList size={16} className={`${activeTab === "General" ? "text-gray-100" : "text-gray-500 group-hover:text-gray-300"}`} />
          <span>Scoreboard</span>
        </button>
        <button
          onClick={() => setActiveTab("Details")}
          className={`flex-1 py-2.5 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm font-medium transition-colors focus:outline-none
                                flex items-center justify-center space-x-2
                                ${activeTab === "Details" ? `${tabActiveBg} text-gray-100` : "text-gray-400 hover:text-gray-100 hover:bg-white/5"}`}
        >
          <PieChart size={16} className={`${activeTab === "Details" ? "text-gray-100" : "text-gray-500 group-hover:text-gray-300"}`} />
          <span>Details</span>
        </button>
      </div>
      {activeTab === "General" && <GeneralTabContent />}
      {activeTab === "Details" && <DetailsTabContent />}
    </div>
  );
};

export default ExpandedMatchDetails;
