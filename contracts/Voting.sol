// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title OpenBallot Educational Voting Demo
/// @notice A public, non-anonymous, single-election demonstration for Sepolia test ETH.
contract Voting {
    struct Candidate {
        string name;
        uint256 voteCount;
    }

    address public immutable owner;
    Candidate[] public candidates;
    mapping(address => bool) public hasVoted;
    bool public electionClosed;
    uint256 public totalVotes;

    error OnlyOwner();
    error ElectionIsClosed();
    error AlreadyVoted();
    error InvalidCandidate();
    error CandidateNameRequired();
    error AtLeastTwoCandidatesRequired();

    event VoteCast(address indexed voter, uint256 indexed candidateIndex, uint256 timestamp);
    event ElectionClosedByOwner(address indexed owner, uint256 timestamp);

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    constructor(string[] memory candidateNames) {
        if (candidateNames.length < 2) revert AtLeastTwoCandidatesRequired();
        owner = msg.sender;

        for (uint256 i = 0; i < candidateNames.length; i++) {
            if (bytes(candidateNames[i]).length == 0) revert CandidateNameRequired();
            candidates.push(Candidate({name: candidateNames[i], voteCount: 0}));
        }
    }

    function candidateCount() external view returns (uint256) {
        return candidates.length;
    }

    function vote(uint256 candidateIndex) external {
        if (electionClosed) revert ElectionIsClosed();
        if (hasVoted[msg.sender]) revert AlreadyVoted();
        if (candidateIndex >= candidates.length) revert InvalidCandidate();

        hasVoted[msg.sender] = true;
        candidates[candidateIndex].voteCount += 1;
        totalVotes += 1;

        emit VoteCast(msg.sender, candidateIndex, block.timestamp);
    }

    function closeElection() external onlyOwner {
        if (electionClosed) revert ElectionIsClosed();
        electionClosed = true;
        emit ElectionClosedByOwner(msg.sender, block.timestamp);
    }
}
