import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';

// Mirrors the tags rule in the API's v1/routes/books.mjs (bookmack-api repo): up to 20 tags of
// 50 characters.
const MAX_TAGS = 20;
const MAX_TAG_LENGTH = 50;
const MAX_SUGGESTIONS = 10;

const normalizeTag = (value: string) => value.replace(/,/g, ' ').trim().replace(/\s+/g, ' ').slice(0, MAX_TAG_LENGTH);
const sameTag = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

type TagInputProps = {
  tags: string[];
  onChange: (tags: string[]) => void;
  // Tags already used in the library, suggested while typing.
  suggestions: string[];
  error?: string | null;
};

// Add tags by typing (then Add, return, or a comma) or by tapping a suggestion; remove them with ×.
export function TagInput({ tags, onChange, suggestions, error }: TagInputProps) {
  const [draft, setDraft] = useState('');
  const full = tags.length >= MAX_TAGS;

  const add = (raw: string) => {
    const value = normalizeTag(raw);
    setDraft('');
    if (!value || full || tags.some((tag) => sameTag(tag, value))) return;
    // Reuse the spelling of a tag already in the library, so "fiction" and "Fiction" don't both exist.
    onChange([...tags, suggestions.find((suggestion) => sameTag(suggestion, value)) ?? value]);
  };

  const search = normalizeTag(draft).toLowerCase();
  const available = suggestions
    .filter((suggestion) => !tags.some((tag) => sameTag(tag, suggestion)))
    .filter((suggestion) => !search || suggestion.toLowerCase().includes(search))
    .slice(0, MAX_SUGGESTIONS);

  return (
    <View style={styles.container}>
      <TextField
        label="Tags"
        value={draft}
        onChangeText={(text) => (text.endsWith(',') ? add(text) : setDraft(text))}
        onSubmitEditing={() => add(draft)}
        submitBehavior="submit"
        returnKeyType="done"
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={MAX_TAG_LENGTH}
        editable={!full}
        error={error}
        hint={full ? `You can add up to ${MAX_TAGS} tags.` : 'Type a tag, then press Add or return.'}
      />

      {search && !full ? (
        <Button title={`Add "${normalizeTag(draft)}"`} variant="secondary" onPress={() => add(draft)} />
      ) : null}

      {/* The tags actually on this book carry the tag glyph. The suggestions further down keep their
          plus, because that one means "tap to add" — an action, not a label — and a pill this size
          has room for one glyph, not both. */}
      {tags.length > 0 ? (
        <View style={styles.chips}>
          {tags.map((tag) => (
            <Chip
              key={tag}
              label={tag}
              tinted
              leadingIcon="tag"
              onRemove={() => onChange(tags.filter((current) => current !== tag))}
            />
          ))}
        </View>
      ) : null}

      {available.length > 0 && !full ? (
        <View style={styles.suggestions}>
          <ThemedText type="small" themeColor="textSecondary">
            {search ? 'Matching tags' : 'Your tags'}
          </ThemedText>
          <View style={styles.chips}>
            {available.map((suggestion) => (
              <Chip key={suggestion} label={suggestion} leadingIcon="plus" onPress={() => add(suggestion)} />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  suggestions: {
    gap: 6
  }
});
