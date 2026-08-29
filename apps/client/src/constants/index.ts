export const LANG_CONFIGS: Record<
    string,
    { image: string; compile?: string[]; run: string[]; defaultCode?: string }
> = {
    cpp: {
        image: 'gcc:15',
        compile: ['g++', '/app/solution.cpp', '-o', '/app/solution'],
        run: ['/app/solution'],
        defaultCode: `#include<iostream>
using namespace std;

int main(){
    
    return 0;
}`,
    },
    python: {
        image: 'python:3.9',
        run: ['python3', '/app/solution.py'],
        defaultCode: '',
    },
    javascript: {
        image: 'node:18',
        run: ['node', '/app/solution.js'],
        defaultCode: '',
    },
    java: {
        image: 'openjdk:17',
        compile: ['javac', '/app/Solution.java'],
        run: ['java', '-cp', '/app', 'Solution'],
        defaultCode: `public class Solution {
    public static void main(String[] args) {
    }
}`,
    },
};
