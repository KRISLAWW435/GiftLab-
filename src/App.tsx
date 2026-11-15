import { useCallback, useEffect, useRef, useState } from 'react';
import { EditorLayout } from './components/EditorLayout';
import { ProjectStart } from './components/ProjectStart';
import { RecipientView } from './components/RecipientView';
import {
  cleanupUnusedProjectImages,
  deleteProject,
  duplicateProject,
  listProjects,
  saveProject,
} from './services/database';
import type { ConstellationProject } from './types/project';

type AppScreen = 'start' | 'editor' | 'preview';

export default function App() {
  const [projects, setProjects] = useState<ConstellationProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState<AppScreen>('start');
  const [activeProject, setActiveProject] = useState<ConstellationProject | null>(
    null,
  );
  const [saveState, setSaveState] = useState<'saved' | 'saving'>('saved');

  const saveTimerRef = useRef<number | null>(null);
  const previewReturnScreenRef = useRef<'start' | 'editor'>('start');

  const reloadProjects = useCallback(async () => {
    try {
      const items = await listProjects();
      setProjects(items);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reloadProjects();
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [reloadProjects]);

  const flushSave = useCallback(
    async (proj: ConstellationProject) => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      setSaveState('saving');
      const saved = await saveProject(proj);
      await cleanupUnusedProjectImages(saved);
      setProjects((prev) => {
        const exists = prev.some((p) => p.id === saved.id);
        const next = exists
          ? prev.map((p) => (p.id === saved.id ? saved : p))
          : [saved, ...prev];
        return [...next].sort((a, b) => b.updatedAt - a.updatedAt);
      });
      setSaveState('saved');
    },
    [],
  );

  const handleCreateProject = async (project: ConstellationProject) => {
    const saved = await saveProject(project);
    setProjects((prev) => [saved, ...prev]);
    setActiveProject(saved);
    setSaveState('saved');
    setScreen('editor');
  };

  const handleOpenProject = (project: ConstellationProject) => {
    setActiveProject(project);
    setSaveState('saved');
    setScreen('editor');
  };

  const handlePreviewProject = (
    project: ConstellationProject,
    from: 'start' | 'editor',
  ) => {
    previewReturnScreenRef.current = from;
    setActiveProject(project);
    setScreen('preview');
  };

  const handleDuplicateProject = async (project: ConstellationProject) => {
    const cloned = await duplicateProject(project);
    setProjects((prev) => [cloned, ...prev]);
  };

  const handleDeleteProject = async (projectId: string) => {
    await deleteProject(projectId);
    setProjects((prev) => prev.filter((p) => p.id !== projectId));
    if (activeProject?.id === projectId) {
      setActiveProject(null);
      setScreen('start');
    }
  };

  const handleUpdateProject = useCallback(
    (updater: (prev: ConstellationProject) => ConstellationProject) => {
      setActiveProject((prev) => {
        if (!prev) return prev;
        const next = { ...updater(prev), updatedAt: Date.now() };
        setSaveState('saving');

        if (saveTimerRef.current) {
          window.clearTimeout(saveTimerRef.current);
        }
        saveTimerRef.current = window.setTimeout(() => {
          flushSave(next);
        }, 450);

        return next;
      });
    },
    [flushSave],
  );

  if (screen === 'preview' && activeProject) {
    return (
      <RecipientView
        project={activeProject}
        onExitPreview={() => setScreen(previewReturnScreenRef.current)}
      />
    );
  }

  if (screen === 'editor' && activeProject) {
    return (
      <EditorLayout
        project={activeProject}
        saveState={saveState}
        onUpdateProject={handleUpdateProject}
        onBackToProjects={async () => {
          await flushSave(activeProject);
          setScreen('start');
        }}
        onOpenPreview={async () => {
          await flushSave(activeProject);
          handlePreviewProject(activeProject, 'editor');
        }}
      />
    );
  }

  return (
    <ProjectStart
      projects={projects}
      loading={loading}
      onCreateProject={handleCreateProject}
      onOpenProject={handleOpenProject}
      onPreviewProject={(proj) => handlePreviewProject(proj, 'start')}
      onDuplicateProject={handleDuplicateProject}
      onDeleteProject={handleDeleteProject}
    />
  );
}
