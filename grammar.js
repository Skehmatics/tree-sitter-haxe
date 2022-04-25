// const types = require("./grammar-types");
// const operations = require("./grammar-operations");
// const expressions = require("./grammar-expressions");
// const declarations = require("./grammar-declarations");
const keywords = require('./grammar-keywords');

const haxe_grammar = {
  name: 'haxe',
  word: ($) => $.identifier,
  inline: ($) => [$.statement, $.expression],
  extras: ($) => [$.comment, /[\s\uFEFF\u2060\u200B\u00A0]/],
  supertypes: ($) => [$.declaration],
  precedences: ($) => [[$._unaryOperator, $._binaryOperator]],
  conflicts: ($) => [
    [$.function_declaration],
    [$.function_declaration, $.variable_declaration],
    [$._prefixUnaryOperator, $._arithmeticOperator],
    [$._prefixUnaryOperator, $._postfixUnaryOperator],
  ],
  rules: {
    module: ($) => seq(repeat($.statement)),

    // Statements
    statement: ($) =>
      choice(
        seq(
          $.expression,
          optional(seq(
            '(',
            repeat1(choice($.attribute, $.call, $.literal, $.operator)),
            ')'
          )),
          choice($.block, $._semicolon)
        ),
        $.import_statement,
        $.package_statement,
        $.preprocessor_statement,
        $.declaration,
        seq(
          $.attribute,
          $.operator,
          choice($.attribute, $.literal, $.call),
          optional($._semicolon)
        ),
        seq($.operator, $.attribute, optional($._semicolon)),
        seq($.attribute, $.operator, optional($._semicolon)),
        seq($.call, optional($._semicolon)),
      ),

    package_statement: ($) =>
      seq(
        alias('package', $.keyword),
        field('name', $.attribute),
        $._semicolon
      ),

    import_statement: ($) =>
      seq(
        choice(alias('import', $.keyword), alias('using', $.keyword)),
        field('name', $.attribute),
        $._semicolon
      ),

    preprocessor_statement: ($) =>
      prec.right(seq(
        '#',
        choice(
          seq(
            token.immediate(choice('if', 'elseif',)),
            choice(
              seq(optional($.operator), choice($.identifier, $.literal)),
              seq('(',repeat1(choice($.identifier, $.literal, $.operator)), ')'),
            ),
          ),
          token.immediate(choice('else', 'end')),
        ),
      )),

    // Declarations
    declaration: ($) =>
      choice(
        $.class_declaration,
        $.function_declaration,
        $.variable_declaration
      ),

    class_declaration: ($) =>
      seq(
        repeat($.metadata),
        alias('class', $.keyword),
        field('name', $.identifier),
        optional(seq('<', repeat(seq($.type_param, ',')), $.type_param, '>')),
        optional(repeat(seq(alias('extends', $.keyword), field('parent', $.attribute)))),
        field('body', $.block)
      ),

    type_param: ($) => $.attribute,

    function_declaration: ($) =>
      seq(
        repeat($.metadata),
        repeat($.keyword),
        alias('function', $.keyword),
        choice(
          field('name', $.identifier),
          field('name', alias('new', $.identifier))
        ),
        seq('(', repeat(seq($.function_arg, optional(','))), ')'),
        optional(seq(':', field('return_type', alias($.attribute, $.type)))),
        field('body', $.block)
      ),

    function_arg: ($) =>
      seq(
        field('name', $.identifier),
        optional(seq(':', alias($.attribute, $.type))),
        optional(seq($._assignmentOperator, $.literal))
      ),

    variable_declaration: ($) =>
      seq(
        repeat($.keyword),
        choice(alias('var', $.keyword), alias('final', $.keyword)),
        field('name', $.identifier),
        optional(seq(':', field('type', alias($.attribute, $.type)))),
        optional(seq($.operator, choice($.literal, seq(optional(alias('new', $.keyword)), $.call)))),
        $._semicolon
      ),
    // Root tokens.
    block: ($) => seq('{', repeat($.statement), '}'),

    metadata: ($) =>
      seq(
        choice('@', '@:'),
        field('name', $.identifier),
        optional(seq('(', $.literal, ')'))
      ),

    expression: ($) =>
      prec.right(choice(
        repeat1(choice($.keyword, $.attribute)),
        seq(alias('cast', $.keyword), '(', $.attribute, ',', field('type', alias($.attribute, $.type)), ')'),
        seq('(', $.attribute, ':', field('type', alias($.attribute, $.type)), ')'),
      )),

    // statement: ($) => seq($.expression, choice($.block, $._semicolon)),
    comment: ($) =>
      token(
        choice(seq('//', /.*/), seq('/*', /[^*]*\*+([^/*][^*]*\*+)*/, '/'))
      ),

    keyword: ($) => prec.right(choice(...keywords)),

    call: ($) =>
      prec(1, seq(
        field('name', $.attribute),
        field('arguments_list', seq(
          '(',
          repeat(seq(
            choice($.literal, $.attribute, $.call, $.operator),
            optional(',')
          )),
          ')'
        )),
      )),

    /* Selects one layer per field access. This looks gross in the tests, but allows for better highlighting in some
       editors, as you can select both the first and last attribute via css selectors: */
    attribute: ($) => seq(
      optional(seq($.attribute, '.')),
      $.identifier,
    ),

    identifier: ($) => /[a-zA-Z_]+[a-zA-Z0-9]*/,

    // From: https://haxe.org/manual/expression-literals.html
    literal: ($) => choice($.integer, $.float, $.string, $.bool, $.null),
    // Match any [42, 0xFF43]
    integer: ($) => choice(/[\d]+/, /0x[a-fA-F\d]+/),
    // Match any [0.32, 3., 2.1e5]
    float: ($) => choice(/[\d]+[\.]+[\d]*/, /[\d]+[\.]+[\d]*e[\d]*/),
    // Match either [true, false]
    bool: ($) => choice('true', 'false'),
    // Match any ["XXX", 'XXX']
    interpolation: ($) =>
      choice(
        $._interpolated_identifier,
        $._interpolated_block
        //         $._interpolated_expression
      ),
    _interpolated_block: ($) => seq('$', $.block),
    _interpolated_identifier: ($) =>
      choice(seq('$', $.attribute), seq('${', $.attribute, '}')),
    //     _interpolated_expression: ($) => seq('$', seq('{', $.expression, '}')),
    string: ($) =>
      choice(
        seq(/\'/, repeat(choice($.interpolation, /[^\']/)), /\'/),
        /\"[^\"]*\"/
      ),
    // match only [null]
    null: ($) => 'null',

    // TODO: array, map, anonymous struct, range
    // array: ($) => "null",

    operator: ($) => choice($._binaryOperator, $._unaryOperator),

    // From: https://haxe.org/manual/expression-operators-unops.html
    _unaryOperator: ($) =>
      prec.right(choice($._prefixUnaryOperator, $._postfixUnaryOperator)),
    _prefixUnaryOperator: ($) => choice('~', '!', '-', '++', '--'),
    _postfixUnaryOperator: ($) => choice('++', '--'),

    // From: https://haxe.org/manual/expression-operators-binops.html
    _binaryOperator: ($) =>
      prec.left(
        choice(
          $._arithmeticOperator,
          $._bitwiseOperator,
          $._logicalOperator,
          $._comparisonOperator,
          $._miscOperator,
          $._assignmentOperator,
          $._compoundAssignmentOperator
        )
      ),
    _arithmeticOperator: ($) => choice('%', '*', '/', '+', '-'),
    _bitwiseOperator: ($) => choice('<<', '>>', '>>>', '&', '|', '^'),
    _logicalOperator: ($) => choice('&&', '||'),
    _comparisonOperator: ($) => choice('==', '!=', '<', '<=', '>', '>='),
    _miscOperator: ($) => choice('...', '=>'),
    _assignmentOperator: ($) => '=',
    _compoundAssignmentOperator: ($) =>
      seq(
        choice($._arithmeticOperator, $._bitwiseOperator),
        $._assignmentOperator
      ),

    type: ($) => $.attribute,

    // Hidden Nodes in tree.
    _semicolon: ($) => ';',
  },
};

// haxe_grammar.rules = Object.assign(
//   haxe_grammar.rules,
//   // types,
//   // operations,
//   // declarations,
//   // expressions,
//   {}
// );

// Took these from
// https://github.com/tree-sitter/tree-sitter-javascript/blob/master/grammar.js
function commaSep1(rule) {
  return seq(rule, repeat(seq(',', rule)));
}

function commaSep(rule) {
  return optional(commaSep1(rule));
}

module.exports = grammar(haxe_grammar);
