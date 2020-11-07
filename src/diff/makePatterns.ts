import { tokenize, Token } from 'source-code-tokenizer';

import { Pattern } from '../patterns';
import { Chunk, makeDiffObj } from './diffparser';

export interface Identifier {
    value: string;
    scope: string;
}

export async function makePatternsFromDiff(diff: string): Promise<Pattern[]> {
    const chunks = makeDiffObj(diff);
    const patterns: Pattern[] = [];
    for (const chunk of chunks) {
        const pattern = await makePatternsFromChunk(chunk);
        if (pattern !== undefined && !isEmptyPattern(pattern.condition) && !isEmptyPattern(pattern.consequent)) {
            patterns.push(pattern);
        }
    }
    return patterns;
}

export function makePatternsFromChunk(chunk: Chunk) {
    return makePatterns(chunk.deleted.join('\n'), chunk.added.join('\n'), chunk.source); 
}

export async function makePatterns(before?: string, after?: string, source?: string): Promise<Pattern|undefined> {
    if (before === undefined || after === undefined || source === undefined) {
        return undefined;
    }

    const beforeTokens = await tokenize(before, source);
    const afterTokens = await tokenize(after, source);

    if (beforeTokens === undefined || afterTokens === undefined) {
        return undefined;
    }

    const identifiers: Identifier[] = collectCommonIdentifiers(beforeTokens.tokens, afterTokens.tokens);
    const conditionPatterns = makeAbstractedCode(beforeTokens.tokens, identifiers);
    const consequentPatterns = makeAbstractedCode(afterTokens.tokens, identifiers);

    const { condition, consequent } = formatPatterns(conditionPatterns, consequentPatterns);

    return {
        condition: condition,
        consequent: consequent,
        identifiers: identifiers.map(identifier => { return identifier.value; })
    };
}

function collectCommonIdentifiers(beforeTokens: Token[], afterTokens: Token[]) {
    const identifiers: Identifier[] = [];
    for (const beforeToken of beforeTokens) {
        const beforeScope = beforeToken.scopes[beforeToken.scopes.length - 1];
        for (const afterToken of afterTokens) {
            const afterScope = afterToken.scopes[afterToken.scopes.length - 1];
            if (beforeToken.value === afterToken.value &&
                beforeScope === afterScope && 
                checkInIdentifiers(identifiers, beforeToken) === undefined &&
                isAbstractable(beforeToken)){
                    identifiers.push({
                        value: beforeToken.value,
                        scope: beforeScope
                    });
                }
        }
    }
    return identifiers;
}


function makeAbstractedCode(tokens: Token[], identifiers: Identifier[]) {
    const patterns: string[] = [];
    let previousPosition = 1;
    let previousLine = 0;
    let lineContents = '';
    for (const token of tokens) {
        if (previousLine === 0) {
            previousLine = token.line;
        }

        if (token.line !== previousLine) {
            patterns.push(lineContents);
            previousPosition = 1;
            previousLine = token.line;
            lineContents = '';
        }

        const spaceNum = token.columns.start - previousPosition;
        previousPosition = token.columns.end;
        const identIndex = checkInIdentifiers(identifiers, token);
        const value = identIndex !== undefined
                      ? `\${${identIndex}:${token.scopes[token.scopes.length - 1]}}`
                      : token.value;

        lineContents += ' '.repeat(spaceNum) + value;
    }
    patterns.push(lineContents);
    return patterns;
}


function checkInIdentifiers(identifiers: Identifier[], token: Token) {
    let identIndex = 1;
    const scope = token.scopes[token.scopes.length - 1];
    for (const identifier of identifiers) {
        if (token.value === identifier.value &&
            scope === identifier.scope) {
                return identIndex;
        }
        identIndex++;
    }
    return undefined;
}

function isAbstractable(token: Token) {
    const scope = token.scopes[token.scopes.length - 1];
    const isAlphanumeric = token.value.match(/^([a-zA-Z][a-zA-Z0-9]*)|[0-9]+$/i);
    return isAlphanumeric && !scope.includes('keyword') && !scope.includes('builtin') && !scope.includes('storage');
}

function isEmptyPattern(pattern: string[]) {
    return pattern.length === 1 && pattern[0] === '';
}

function formatPatterns(conditon: string[], consequent: string[]) {
    const minSpace = Math.min(countSpace(conditon), countSpace(consequent));
    const formatCondition = [];
    for (const line of conditon) {
        formatCondition.push(line.slice(minSpace));
    }
    const formatConsequent = [];
    for (const line of consequent) {
        formatConsequent.push(line.slice(minSpace));
    }
    return {condition: formatCondition, consequent: formatConsequent};
}

function countSpace(patternLines: string[]) {
    const spaces: number[] = [];
    for (const patternLine of patternLines) {
        if (patternLine === '') { continue; } 
        let spaceNum = 0;
        for (const character of patternLine) {
            if (character === ' ') {
                spaceNum++;
            } else {
                break;
            }
        }
        spaces.push(spaceNum);
    }
    return Math.min(...spaces);
}