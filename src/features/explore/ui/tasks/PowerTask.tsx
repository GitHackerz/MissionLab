'use client';

import React from 'react';
import { PowerPlanner } from '@/features/mission-ui/components/PowerPlanner';

/** Focused power board: wiring schematic, switches with reasons, engine forecast, apply. */
export const PowerTask: React.FC = () => <PowerPlanner schematic />;
