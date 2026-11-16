import type {
  ConstellationProject,
  ConstellationStar,
  RecipientPhase,
} from '../types/project';

export type EditableCardTarget = 'text' | 'illustration' | 'decor';

export interface PreviewJumpTarget {
  nonce: number;
  phase: 'sealed' | 'starStory' | 'constellation';
  starIndex?: number;
}

export type ParentToIframeMessage = {
  source: 'giftlab-preview-host';
  type: 'sync';
  project: ConstellationProject;
  editMode: boolean;
  selectedTarget: EditableCardTarget | null;
  jumpTo?: PreviewJumpTarget | null;
};

export type IframeToParentMessage =
  | {
      source: 'giftlab-preview-iframe';
      type: 'ready';
      phase: RecipientPhase;
      activeIndex: number;
    }
  | {
      source: 'giftlab-preview-iframe';
      type: 'state';
      phase: RecipientPhase;
      activeIndex: number;
    }
  | {
      source: 'giftlab-preview-iframe';
      type: 'selectTarget';
      target: EditableCardTarget | null;
    }
  | {
      source: 'giftlab-preview-iframe';
      type: 'patchStar';
      starId: string;
      patch: Partial<ConstellationStar>;
    }
  | {
      source: 'giftlab-preview-iframe';
      type: 'patchProject';
      patch: Partial<ConstellationProject>;
    };
