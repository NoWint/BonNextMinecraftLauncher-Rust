import { downloadReducer as reducer } from '../downloadStore';
import type { DownloadTask } from '../downloadStore';

const initialState = { tasks: [] as DownloadTask[] };

const mockTask: DownloadTask = {
  id: 'task-1',
  title: 'Fabric Loader',
  filename: 'fabric-loader.jar',
  status: 'pending',
  startedAt: Date.now(),
};

describe('downloadStore reducer', () => {
  it('returns initial state for unknown action', () => {
    const state = reducer(initialState, { type: 'UNKNOWN' } as never);
    expect(state).toEqual(initialState);
  });

  it('handles ADD_TASK', () => {
    const state = reducer(initialState, { type: 'ADD_TASK', task: mockTask });
    expect(state.tasks).toHaveLength(1);
    expect(state.tasks[0]).toEqual(mockTask);
  });

  it('ADD_TASK prepends to front', () => {
    const withOne = reducer(initialState, { type: 'ADD_TASK', task: mockTask });
    const secondTask = { ...mockTask, id: 'task-2', title: 'Second' };
    const state = reducer(withOne, { type: 'ADD_TASK', task: secondTask });
    expect(state.tasks).toHaveLength(2);
    expect(state.tasks[0].id).toBe('task-2');
  });

  it('ADD_TASK limits to 50 tasks', () => {
    let state = initialState;
    for (let i = 0; i < 55; i++) {
      state = reducer(state, {
        type: 'ADD_TASK',
        task: { ...mockTask, id: `task-${i}` },
      });
    }
    expect(state.tasks).toHaveLength(50);
  });

  it('handles UPDATE_TASK status', () => {
    const withTask = reducer(initialState, { type: 'ADD_TASK', task: mockTask });
    const state = reducer(withTask, {
      type: 'UPDATE_TASK',
      id: 'task-1',
      status: 'downloading',
    });
    expect(state.tasks[0].status).toBe('downloading');
  });

  it('handles UPDATE_TASK with progress', () => {
    const withTask = reducer(initialState, { type: 'ADD_TASK', task: mockTask });
    const state = reducer(withTask, {
      type: 'UPDATE_TASK',
      id: 'task-1',
      status: 'downloading',
      progress: 50,
      speed: 1024,
      eta: 10,
    });
    expect(state.tasks[0].progress).toBe(50);
    expect(state.tasks[0].speed).toBe(1024);
    expect(state.tasks[0].eta).toBe(10);
  });

  it('handles UPDATE_TASK complete', () => {
    const downloading = reducer(initialState, { type: 'ADD_TASK', task: { ...mockTask, status: 'downloading' } });
    const state = reducer(downloading, {
      type: 'UPDATE_TASK',
      id: 'task-1',
      status: 'complete',
      progress: 100,
    });
    expect(state.tasks[0].status).toBe('complete');
    expect(state.tasks[0].progress).toBe(100);
  });

  it('handles UPDATE_TASK with error', () => {
    const withTask = reducer(initialState, { type: 'ADD_TASK', task: mockTask });
    const state = reducer(withTask, {
      type: 'UPDATE_TASK',
      id: 'task-1',
      status: 'failed',
      error: 'Connection timeout',
    });
    expect(state.tasks[0].status).toBe('failed');
    expect(state.tasks[0].error).toBe('Connection timeout');
  });

  it('UPDATE_TASK does not affect other tasks', () => {
    const withTwo = [
      { ...mockTask, id: 'task-1' },
      { ...mockTask, id: 'task-2' },
    ];
    const state = reducer({ tasks: withTwo }, { type: 'UPDATE_TASK', id: 'task-1', status: 'complete' });
    expect(state.tasks[0].status).toBe('complete');
    expect(state.tasks[1].status).toBe('pending');
  });

  it('handles REMOVE_TASK', () => {
    const withTask = reducer(initialState, { type: 'ADD_TASK', task: mockTask });
    const state = reducer(withTask, { type: 'REMOVE_TASK', id: 'task-1' });
    expect(state.tasks).toHaveLength(0);
  });

  it('REMOVE_TASK does not affect other tasks', () => {
    const withTwo = [
      { ...mockTask, id: 'task-1' },
      { ...mockTask, id: 'task-2' },
    ];
    const state = reducer({ tasks: withTwo }, { type: 'REMOVE_TASK', id: 'task-1' });
    expect(state.tasks).toHaveLength(1);
    expect(state.tasks[0].id).toBe('task-2');
  });

  it('handles CLEAR_COMPLETED', () => {
    const tasks = [
      { ...mockTask, id: 'task-1', status: 'complete' as const },
      { ...mockTask, id: 'task-2', status: 'downloading' as const },
      { ...mockTask, id: 'task-3', status: 'failed' as const },
      { ...mockTask, id: 'task-4', status: 'pending' as const },
    ];
    const state = reducer({ tasks }, { type: 'CLEAR_COMPLETED' });
    expect(state.tasks).toHaveLength(2);
    expect(state.tasks.map((t) => t.id)).toEqual(['task-2', 'task-4']);
  });

  it('CLEAR_COMPLETED removes both complete and failed', () => {
    const tasks = [
      { ...mockTask, id: 'task-1', status: 'complete' as const },
      { ...mockTask, id: 'task-2', status: 'failed' as const },
    ];
    const state = reducer({ tasks }, { type: 'CLEAR_COMPLETED' });
    expect(state.tasks).toHaveLength(0);
  });
});
