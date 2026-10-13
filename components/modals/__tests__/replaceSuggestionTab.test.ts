import { suggestionsBelongOnTab } from '@/components/modals/replaceSuggestionTab';

describe('suggestionsBelongOnTab', () => {
  it('shows the suggestions on All and on the replaced exercise’s own region', () => {
    expect(suggestionsBelongOnTab('all', 'torso')).toBe(true);
    expect(suggestionsBelongOnTab('torso', 'torso')).toBe(true);
  });

  it('hides them once the user browses another region, so a chest pick cannot linger on Legs', () => {
    expect(suggestionsBelongOnTab('legs', 'torso')).toBe(false);
  });

  it('hides them on a region tab while the replaced exercise is still loading', () => {
    expect(suggestionsBelongOnTab('legs', null)).toBe(false);
    expect(suggestionsBelongOnTab('all', null)).toBe(true);
  });
});
